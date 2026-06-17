package com.example.PaymentSystem.repository;

import com.example.PaymentSystem.entity.Wallet;
import com.example.PaymentSystem.enums.WalletStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WalletRepository extends JpaRepository<Wallet, UUID> {
    List<Wallet> findByUser_Id(UUID userId);

    Optional<Wallet> findByIdAndStatus(UUID id, WalletStatus status);
}

