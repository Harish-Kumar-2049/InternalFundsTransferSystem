package com.example.PaymentSystem.controller;

import com.example.PaymentSystem.dto.response.AuditLogResponse;
import com.example.PaymentSystem.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditLogService auditLogService;

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<AuditLogResponse>> getUserLogs(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(auditLogService.getLogsByUser(userId));
    }

    @GetMapping("/transaction/{transactionId}")
    public ResponseEntity<List<AuditLogResponse>> getTransactionLogs(
            @PathVariable UUID transactionId) {
        return ResponseEntity.ok(auditLogService.getLogsByTransaction(transactionId));
    }
}

