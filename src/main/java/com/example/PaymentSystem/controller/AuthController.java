package com.example.PaymentSystem.controller;

import com.example.PaymentSystem.dto.request.LoginRequest;
import com.example.PaymentSystem.dto.request.RegisterRequest;
import com.example.PaymentSystem.dto.response.AuthResponse;
import com.example.PaymentSystem.entity.User;
import com.example.PaymentSystem.security.JwtUtil;
import com.example.PaymentSystem.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request) {
        User user = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message", "User registered successfully",
                        "userId", user.getId().toString()
                ));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(), request.getPassword()));

        User user = userService.findByEmail(request.getEmail());
        String role = user.getRole().name();
        String token = jwtUtil.generateToken(user.getEmail(), role);

        return ResponseEntity.ok(
                new AuthResponse(token, user.getEmail(), role, user.getId().toString()));
    }
}

