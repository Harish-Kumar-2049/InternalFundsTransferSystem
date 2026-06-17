package com.example.PaymentSystem.controller;

import com.example.PaymentSystem.dto.response.AuditLogResponse;
import com.example.PaymentSystem.dto.response.LedgerEntryResponse;
import com.example.PaymentSystem.dto.response.ReconcileEntryResponse;
import com.example.PaymentSystem.dto.response.TransactionResponse;
import com.example.PaymentSystem.dto.response.UserWalletsResponse;
import com.example.PaymentSystem.service.AuditLogService;
import com.example.PaymentSystem.service.LedgerService;
import com.example.PaymentSystem.service.TransactionService;
import com.example.PaymentSystem.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final TransactionService transactionService;
    private final AuditLogService auditLogService;

    // ── Deposit ─────────────────────────────────────────────────────────────

    @PostMapping("/wallets/{walletId}/deposit")
    public ResponseEntity<Map<String, String>> deposit(
            @PathVariable UUID walletId,
            @RequestParam BigDecimal amount) {
        walletService.adminDeposit(walletId, amount);
        return ResponseEntity.ok(Map.of(
                "message", "Deposit successful",
                "walletId", walletId.toString(),
                "amount", amount.toString()
        ));
    }

    // ── User Lookup ─────────────────────────────────────────────────────────

    @GetMapping("/users/lookup")
    public ResponseEntity<UserWalletsResponse> lookupUserWallets(
            @RequestParam String query) {
        return ResponseEntity.ok(walletService.lookupUserWallets(query));
    }

    // ── Ledger Explorer ─────────────────────────────────────────────────────

    @GetMapping("/ledger/wallet/{walletId}")
    public ResponseEntity<List<LedgerEntryResponse>> getLedgerByWallet(
            @PathVariable UUID walletId) {
        return ResponseEntity.ok(ledgerService.getEntriesByWallet(walletId));
    }

    @GetMapping("/ledger/transaction/{transactionId}")
    public ResponseEntity<List<LedgerEntryResponse>> getLedgerByTransaction(
            @PathVariable UUID transactionId) {
        return ResponseEntity.ok(ledgerService.getEntriesByTransaction(transactionId));
    }

    // ── Reconcile ───────────────────────────────────────────────────────────

    @PostMapping("/reconcile")
    public ResponseEntity<List<ReconcileEntryResponse>> reconcileAll() {
        return ResponseEntity.ok(ledgerService.reconcileAll());
    }

    // ── Verify Transaction ──────────────────────────────────────────────────

    @GetMapping("/transactions/{transactionId}/verify")
    public ResponseEntity<Map<String, Object>> verifyTransaction(
            @PathVariable UUID transactionId) {
        boolean balanced = ledgerService.verifyTransaction(transactionId);
        return ResponseEntity.ok(Map.of(
                "transactionId", transactionId.toString(),
                "balanced", balanced
        ));
    }

    // ── Transaction History ─────────────────────────────────────────────────

    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getAllTransactions() {
        return ResponseEntity.ok(transactionService.getAllTransactions());
    }

    // ── All Audit Logs ──────────────────────────────────────────────────────

    @GetMapping("/audit")
    public ResponseEntity<List<AuditLogResponse>> getAllAuditLogs() {
        return ResponseEntity.ok(auditLogService.getAllLogs());
    }
}


