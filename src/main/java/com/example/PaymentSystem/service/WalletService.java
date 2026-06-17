package com.example.PaymentSystem.service;

import com.example.PaymentSystem.dto.response.UserWalletsResponse;
import com.example.PaymentSystem.dto.response.WalletResponse;
import com.example.PaymentSystem.entity.User;
import com.example.PaymentSystem.entity.Wallet;
import com.example.PaymentSystem.enums.WalletStatus;
import com.example.PaymentSystem.exception.InsufficientFundsException;
import com.example.PaymentSystem.exception.ResourceNotFoundException;
import com.example.PaymentSystem.repository.UserRepository;
import com.example.PaymentSystem.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public WalletResponse createWallet(UUID userId, String currency) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean hasActiveWallet = walletRepository.findByUser_Id(userId).stream()
                .anyMatch(w -> w.getStatus() == WalletStatus.ACTIVE);

        Wallet wallet = new Wallet();
        wallet.setUser(user);
        wallet.setCurrency("INR");
        wallet.setBalance(BigDecimal.ZERO);
        wallet.setStatus(WalletStatus.ACTIVE);
        wallet.setPrimary(!hasActiveWallet);

        Wallet saved = walletRepository.save(wallet);
        auditLogService.log(userId, null,
                "WALLET_CREATED", "WALLET", null, saved.getId().toString());

        return mapToResponse(saved);
    }

    public WalletResponse getWallet(UUID walletId) {
        Wallet wallet = walletRepository
                .findByIdAndStatus(walletId, WalletStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found or inactive"));
        return mapToResponse(wallet);
    }

    public List<WalletResponse> getUserWallets(UUID userId) {
        return walletRepository.findByUser_Id(userId)
                .stream().map(this::mapToResponse).toList();
    }

    public void debit(UUID walletId, BigDecimal amount) {
        Wallet wallet = walletRepository
                .findByIdAndStatus(walletId, WalletStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Source wallet not found"));

        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException("Insufficient balance in wallet");
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);
    }

    public void credit(UUID walletId, BigDecimal amount) {
        Wallet wallet = walletRepository
                .findByIdAndStatus(walletId, WalletStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Target wallet not found"));

        wallet.setBalance(wallet.getBalance().add(amount));
        walletRepository.save(wallet);
    }

    public void adminDeposit(UUID walletId, BigDecimal amount) {
        credit(walletId, amount);
        auditLogService.log(null, null,
                "ADMIN_DEPOSIT", "WALLET", null,
                "Deposited " + amount + " to wallet " + walletId);
    }

    @Transactional
    public WalletResponse setPrimaryWallet(UUID userId, UUID walletId) {
        List<Wallet> wallets = walletRepository.findByUser_Id(userId);
        Wallet targetWallet = wallets.stream()
                .filter(w -> w.getId().equals(walletId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found or does not belong to user"));

        for (Wallet w : wallets) {
            w.setPrimary(w.getId().equals(walletId));
            walletRepository.save(w);
        }

        auditLogService.log(userId, null,
                "WALLET_PRIMARY_UPDATED", "WALLET", null, walletId.toString());

        return mapToResponse(targetWallet);
    }

    public UserWalletsResponse lookupUserWallets(String query) {
        User user = null;
        // 1. Try treating query as Wallet ID UUID
        try {
            UUID walletId = UUID.fromString(query.trim());
            Wallet wallet = walletRepository.findById(walletId).orElse(null);
            if (wallet != null) {
                user = wallet.getUser();
            }
        } catch (IllegalArgumentException e) {
            // Not a UUID
        }

        // 2. Try treating query as User ID UUID if user is still null
        if (user == null) {
            try {
                UUID userId = UUID.fromString(query.trim());
                user = userRepository.findById(userId).orElse(null);
            } catch (IllegalArgumentException e) {
                // Not a UUID
            }
        }

        // 3. Try treating query as email
        if (user == null) {
            user = userRepository.findByEmail(query.trim()).orElse(null);
        }

        if (user == null) {
            throw new ResourceNotFoundException("No user or wallet found for query: " + query);
        }

        List<WalletResponse> wallets = getUserWallets(user.getId());
        return UserWalletsResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .wallets(wallets)
                .build();
    }

    private WalletResponse mapToResponse(Wallet wallet) {
        return WalletResponse.builder()
                .id(wallet.getId())
                .balance(wallet.getBalance())
                .currency(wallet.getCurrency())
                .status(wallet.getStatus().name())
                .isPrimary(wallet.isPrimary())
                .createdAt(LocalDateTime.ofInstant(wallet.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}

