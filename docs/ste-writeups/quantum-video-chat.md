---
title: Quantum Video Chat
summary: Peer-to-peer video encrypted with keys from a simulated BB84 quantum key-distribution protocol — with live eavesdropper detection.
---

This is end-to-end encrypted, peer-to-peer video. The encryption keys come from a **simulated BB84 quantum key-distribution** protocol, not from a classical key exchange. I built it during my research internship at Qualcomm Institute.

## How it works

The full QKD pipeline runs client-side:

1. **sifting** — keep only the bits where the two parties' bases matched
2. **error estimation** — measure the quantum bit error rate (QBER)
3. **Cascade** error correction — reconcile the shared key across the public channel
4. **Toeplitz** privacy amplification — remove the data that an eavesdropper got.

The resulting key drives **AES-128-GCM** encryption of the WebRTC media streams through **Insertable Streams**.

## The tamper alarm

The protocol carries its own tamper alarm: **eavesdropper detection rejects and re-exchanges keys when the QBER exceeds 11%** — the threshold above which you can no longer distill a safe key.

## Verification

There are **94 tests**, across the Python signaling server and the JavaScript client.

## Stack

Python signaling server · JavaScript client (BB84 simulation, WebRTC, Insertable Streams, Web Crypto AES-GCM).
