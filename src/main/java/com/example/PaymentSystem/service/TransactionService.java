package com.example.PaymentSystem.service;

import com.example.PaymentSystem.dto.request.RefundRequest;
import com.example.PaymentSystem.dto.request.TransferRequest;
import com.example.PaymentSystem.dto.response.TransactionResponse;
import com.example.PaymentSystem.entity.Transaction;
import com.example.PaymentSystem.entity.User;
import com.example.PaymentSystem.entity.Wallet;
import com.example.PaymentSystem.enums.TransactionStatus;
import com.example.PaymentSystem.enums.TransactionType;
import com.example.PaymentSystem.enums.WalletStatus;
import com.example.PaymentSystem.exception.DuplicateTransactionException;
import com.example.PaymentSystem.exception.ResourceNotFoundException;
import com.example.PaymentSystem.repository.TransactionRepository;
import com.example.PaymentSystem.repository.UserRepository;
import com.example.PaymentSystem.repository.WalletRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final AuditLogService auditLogService;
    private final IdempotencyService idempotencyService;
    private final com.example.PaymentSystem.event.PaymentEventPublisher paymentEventPublisher;
    private final jakarta.persistence.EntityManager entityManager;

    @Transactional
    public TransactionResponse transfer(TransferRequest request, UUID initiatedByUserId) {
        // Redis idempotency check — fast, before any DB touch
        String idempotencyKey = request.getIdempotencyKey().toString();
        if (!idempotencyService.isNewRequest(idempotencyKey)) {
            throw new DuplicateTransactionException(
                    "Duplicate request — already processed");
        }

        Wallet source = walletRepository.findById(request.getSourceWalletId())
                .filter(w -> w.getStatus() == WalletStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Source wallet not found"));

        // Find recipient user by email or by user ID (UUID)
        User targetUser = null;
        String recipientIdStr = request.getRecipientIdentifier().trim();
        try {
            UUID targetUserId = UUID.fromString(recipientIdStr);
            targetUser = userRepository.findById(targetUserId).orElse(null);
        } catch (IllegalArgumentException e) {
            // Not a UUID format, proceed to email lookup
        }

        if (targetUser == null) {
            targetUser = userRepository.findByEmail(recipientIdStr)
                    .orElseThrow(() -> new ResourceNotFoundException("Recipient user not found for: " + recipientIdStr));
        }

        // Find target user's wallets
        List<Wallet> targetWallets = walletRepository.findByUser_Id(targetUser.getId());
        if (targetWallets.isEmpty()) {
            throw new ResourceNotFoundException("Recipient user has no wallets");
        }

        // Target wallet is the recipient's primary active wallet
        Wallet target = targetWallets.stream()
                .filter(w -> w.getStatus() == WalletStatus.ACTIVE && w.isPrimary())
                .findFirst()
                .orElse(null);

        // Fallback: if no wallet is explicitly marked primary, use the oldest active wallet
        if (target == null) {
            target = targetWallets.stream()
                    .filter(w -> w.getStatus() == WalletStatus.ACTIVE)
                    .min(java.util.Comparator.comparing(Wallet::getCreatedAt))
                    .orElseThrow(() -> new ResourceNotFoundException("Recipient has no active wallet"));
        }

        Transaction txn = new Transaction();
        txn.setIdempotencyKey(idempotencyKey);
        txn.setSourceWallet(source);
        txn.setTargetWallet(target);
        txn.setAmount(request.getAmount());
        txn.setType(TransactionType.TRANSFER);
        txn.setStatus(TransactionStatus.INITIATED);
        Transaction saved = transactionRepository.save(txn);

        try {
            saved.setStatus(TransactionStatus.PENDING);
            transactionRepository.save(saved);

            // Flush pending changes (like the transaction PENDING status) to DB.
            // Clear the 1st-level cache before locking.
            // This forces Hibernate to throw away the stale wallet objects fetched
            // earlier without a lock, ensuring the lock queries fetch absolutely
            // fresh data from the DB. Without this, Hibernate serves the cached
            // (stale) balance even after acquiring the row lock — causing a
            // silent lost-update bug where the balance arithmetic runs on old data.
            entityManager.flush();
            entityManager.clear();

            UUID firstLockId  = source.getId().compareTo(target.getId()) < 0
                    ? source.getId() : target.getId();
            UUID secondLockId = source.getId().compareTo(target.getId()) < 0
                    ? target.getId() : source.getId();

            walletRepository.findByIdWithLock(firstLockId)
                    .orElseThrow(() -> new ResourceNotFoundException("Wallet not found during lock acquisition"));
            walletRepository.findByIdWithLock(secondLockId)
                    .orElseThrow(() -> new ResourceNotFoundException("Wallet not found during lock acquisition"));
            // Both rows are now exclusively locked for the rest of this transaction.

            walletService.debit(source.getId(), request.getAmount());
            walletService.credit(target.getId(), request.getAmount());

            BigDecimal sourceBalanceAfter = walletRepository.findById(source.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Source wallet not found"))
                    .getBalance();
            BigDecimal targetBalanceAfter = walletRepository.findById(target.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Target wallet not found"))
                    .getBalance();

            ledgerService.recordDebit(source.getId(), saved.getId(),
                    request.getAmount(), sourceBalanceAfter);
            ledgerService.recordCredit(target.getId(), saved.getId(),
                    request.getAmount(), targetBalanceAfter);

            saved.setStatus(TransactionStatus.SUCCESS);
            transactionRepository.save(saved);

            // mark idempotency as completed
            idempotencyService.markCompleted(idempotencyKey);

            auditLogService.log(initiatedByUserId, saved.getId(),
                    "TRANSFER_SUCCESS", "TRANSACTION",
                    TransactionStatus.PENDING.name(),
                    TransactionStatus.SUCCESS.name());

            // publish payment event
            paymentEventPublisher.publishPaymentSuccess(
                    saved.getId(),
                    request.getSourceWalletId(),
                    target.getId(),
                    request.getAmount());

            return mapToResponse(saved);

        } catch (Exception e) {
            // mark idempotency as failed so client can retry
            idempotencyService.markFailed(idempotencyKey);

            saved.setStatus(TransactionStatus.FAILED);
            transactionRepository.save(saved);

            auditLogService.log(initiatedByUserId, saved.getId(),
                    "TRANSFER_FAILED", "TRANSACTION",
                    TransactionStatus.PENDING.name(),
                    TransactionStatus.FAILED.name());

            throw e;
        }
    }

    @Transactional
    public TransactionResponse refund(RefundRequest request, UUID initiatedByUserId) {
        Transaction original = transactionRepository.findById(request.getTransactionId())
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));

        if (original.getStatus() != TransactionStatus.SUCCESS) {
            throw new IllegalStateException("Only successful transactions can be refunded");
        }

        // A refund reverses target → source, which is the opposite direction of
        // the original transfer (source → target). Without ordered locking a
        // concurrent original-direction transfer and this refund would deadlock.
        // We apply the same UUID-sorted lock acquisition used in transfer().
        entityManager.flush();
        entityManager.clear();
        UUID refundFirstLockId  = original.getTargetWallet().getId()
                .compareTo(original.getSourceWallet().getId()) < 0
                ? original.getTargetWallet().getId()
                : original.getSourceWallet().getId();
        UUID refundSecondLockId = original.getTargetWallet().getId()
                .compareTo(original.getSourceWallet().getId()) < 0
                ? original.getSourceWallet().getId()
                : original.getTargetWallet().getId();

        walletRepository.findByIdWithLock(refundFirstLockId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found during refund lock"));
        walletRepository.findByIdWithLock(refundSecondLockId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found during refund lock"));
        // Both rows are now exclusively locked for the rest of this transaction.

        walletService.debit(original.getTargetWallet().getId(), original.getAmount());
        walletService.credit(original.getSourceWallet().getId(), original.getAmount());

        original.setStatus(TransactionStatus.REFUNDED);
        original.setRefundReason(request.getReason());
        transactionRepository.save(original);

        auditLogService.log(initiatedByUserId, original.getId(),
                "REFUND_SUCCESS", "TRANSACTION",
                TransactionStatus.SUCCESS.name(),
                TransactionStatus.REFUNDED.name());

        // publish refund event
        paymentEventPublisher.publishRefundSuccess(
                original.getId(),
                original.getAmount());

        return mapToResponse(original);
    }

    public TransactionResponse getTransaction(UUID transactionId) {
        Transaction txn = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        return mapToResponse(txn);
    }

    private TransactionResponse mapToResponse(Transaction txn) {
        return TransactionResponse.builder()
                .id(txn.getId())
                .amount(txn.getAmount())
                .type(txn.getType().name())
                .status(txn.getStatus().name())
                .sourceWalletId(txn.getSourceWallet().getId())
                .targetWalletId(txn.getTargetWallet().getId())
                .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
