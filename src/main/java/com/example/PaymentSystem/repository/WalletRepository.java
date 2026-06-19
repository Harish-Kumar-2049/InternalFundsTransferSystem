package com.example.PaymentSystem.repository;

import com.example.PaymentSystem.entity.Wallet;
import com.example.PaymentSystem.enums.WalletStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WalletRepository extends JpaRepository<Wallet, UUID> {
    List<Wallet> findByUser_Id(UUID userId);

    Optional<Wallet> findByIdAndStatus(UUID id, WalletStatus status);

    /**
     * Acquires a PostgreSQL row-level exclusive lock (SELECT … FOR UPDATE).
     * Must be called inside an active @Transactional method.
     * No other transaction can read-for-update or write this row until the
     * surrounding transaction commits or rolls back.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.id = :id")
    Optional<Wallet> findByIdWithLock(@Param("id") UUID id);

    /**
     * Same as above but also filters by status in-query so the caller
     * doesn't need a second round-trip to check ACTIVE/SUSPENDED.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.id = :id AND w.status = :status")
    Optional<Wallet> findByIdAndStatusWithLock(@Param("id") UUID id,
                                               @Param("status") WalletStatus status);
}

