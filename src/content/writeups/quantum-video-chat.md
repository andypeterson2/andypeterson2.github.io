---
title: Quantum Video Chat
summary: Peer-to-peer video encrypted with keys from a simulated BB84 quantum key-distribution protocol — with live eavesdropper detection.
---

End-to-end encrypted, peer-to-peer video where the encryption keys are established through a **simulated BB84 quantum key-distribution** protocol rather than classical key exchange. Built during my research internship at Qualcomm Institute.

## How it works

The full QKD pipeline runs client-side:

1. **sifting** — keep only the bits where the two parties' bases matched;
2. **error estimation** — sample the quantum bit error rate (QBER);
3. **Cascade** error correction — reconcile the shared key over the public channel;
4. **Toeplitz** privacy amplification — hash out any information an eavesdropper could have gained.

The resulting key drives **AES-128-GCM** encryption of the WebRTC media streams via **Insertable Streams**.

## The security property

The protocol carries its own tamper alarm: **eavesdropper detection rejects and re-exchanges keys whenever the QBER exceeds 11%** — the threshold above which a secure key can no longer be distilled.

## What's real

Backed by **94 tests** across the Python signaling server and the JavaScript client.

## Stack

Python signaling server · JavaScript client (BB84 simulation, WebRTC, Insertable Streams, Web Crypto AES-GCM).
