package com.example.PaymentSystem.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LedgerEntryResponse {
    private UUID id;
    private UUID transactionId;
    private UUID walletId;
    private String entryType;   // DEBIT | CREDIT
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private Instant createdAt;
}
