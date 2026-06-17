package com.example.PaymentSystem.service;

import com.example.PaymentSystem.dto.response.LedgerEntryResponse;
import com.example.PaymentSystem.dto.response.ReconcileEntryResponse;
import com.example.PaymentSystem.entity.LedgerEntry;
import com.example.PaymentSystem.entity.Transaction;
import com.example.PaymentSystem.entity.Wallet;
import com.example.PaymentSystem.enums.LedgerEntryType;
import com.example.PaymentSystem.exception.ResourceNotFoundException;
import com.example.PaymentSystem.repository.LedgerEntryRepository;
import com.example.PaymentSystem.repository.TransactionRepository;
import com.example.PaymentSystem.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;

    public void recordDebit(UUID walletId, UUID transactionId,
                             BigDecimal amount, BigDecimal balanceAfter) {
        LedgerEntry entry = buildEntry(walletId, transactionId, amount, balanceAfter, LedgerEntryType.DEBIT);
        ledgerEntryRepository.save(entry);
    }

    public void recordCredit(UUID walletId, UUID transactionId,
                              BigDecimal amount, BigDecimal balanceAfter) {
        LedgerEntry entry = buildEntry(walletId, transactionId, amount, balanceAfter, LedgerEntryType.CREDIT);
        ledgerEntryRepository.save(entry);
    }

    public boolean reconcile(UUID walletId, BigDecimal currentBalance) {
        BigDecimal credits = ledgerEntryRepository.sumCreditsByWalletId(walletId);
        BigDecimal debits = ledgerEntryRepository.sumDebitsByWalletId(walletId);
        BigDecimal expected = credits.subtract(debits);
        return expected.compareTo(currentBalance) == 0;
    }

    // ── Admin: Ledger Explorer ──────────────────────────────────────────────

    public List<LedgerEntryResponse> getEntriesByWallet(UUID walletId) {
        return ledgerEntryRepository.findByWallet_Id(walletId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<LedgerEntryResponse> getEntriesByTransaction(UUID transactionId) {
        return ledgerEntryRepository.findByTransaction_Id(transactionId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ── Admin: Reconcile all wallets ────────────────────────────────────────

    public List<ReconcileEntryResponse> reconcileAll() {
        return walletRepository.findAll().stream()
                .map(wallet -> {
                    BigDecimal credits = ledgerEntryRepository.sumCreditsByWalletId(wallet.getId());
                    BigDecimal debits  = ledgerEntryRepository.sumDebitsByWalletId(wallet.getId());
                    BigDecimal ledgerBalance = credits.subtract(debits);
                    BigDecimal actual = wallet.getBalance();
                    return ReconcileEntryResponse.builder()
                            .walletId(wallet.getId())
                            .ledgerBalance(ledgerBalance)
                            .actualBalance(actual)
                            .balanced(ledgerBalance.compareTo(actual) == 0)
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ── Admin: Verify a single transaction ─────────────────────────────────

    public boolean verifyTransaction(UUID transactionId) {
        List<LedgerEntry> entries = ledgerEntryRepository.findByTransaction_Id(transactionId);
        BigDecimal totalDebit  = entries.stream()
                .filter(e -> e.getEntryType() == LedgerEntryType.DEBIT)
                .map(LedgerEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCredit = entries.stream()
                .filter(e -> e.getEntryType() == LedgerEntryType.CREDIT)
                .map(LedgerEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return totalDebit.compareTo(totalCredit) == 0;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private LedgerEntry buildEntry(UUID walletId, UUID transactionId, BigDecimal amount,
                                   BigDecimal balanceAfter, LedgerEntryType type) {
        Wallet wallet = walletRepository.findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));

        LedgerEntry entry = new LedgerEntry();
        entry.setWallet(wallet);
        entry.setTransaction(transaction);
        entry.setEntryType(type);
        entry.setAmount(amount);
        entry.setBalanceAfter(balanceAfter);
        return entry;
    }

    private LedgerEntryResponse toResponse(LedgerEntry e) {
        return LedgerEntryResponse.builder()
                .id(e.getId())
                .transactionId(e.getTransaction().getId())
                .walletId(e.getWallet().getId())
                .entryType(e.getEntryType().name())
                .amount(e.getAmount())
                .balanceAfter(e.getBalanceAfter())
                .createdAt(e.getCreatedAt())
                .build();
    }
}

