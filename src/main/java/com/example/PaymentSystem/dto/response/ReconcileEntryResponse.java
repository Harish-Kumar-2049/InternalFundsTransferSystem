package com.example.PaymentSystem.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReconcileEntryResponse {
    private UUID walletId;
    private BigDecimal ledgerBalance;   // credits − debits
    private BigDecimal actualBalance;   // wallet.balance column
    private boolean balanced;           // true when both match
}
