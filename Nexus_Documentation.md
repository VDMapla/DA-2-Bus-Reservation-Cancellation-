# 🚌 Nexus: C++ WASM Bus Reservation & Revenue System
**Developer Documentation & Examination Guide**

> [!IMPORTANT]
> This document outlines the complete architectural conversion of a raw command-line C++ application into a high-performance WebAssembly Web Application with permanent state persistence.

---

## 🏗️ 1. Core Architecture Stack

The Nexus system operates on a hybrid technology stack to guarantee memory-efficient math computing alongside a premium user interface.

* **Backend Engine**: Native `C++17` using Object-Oriented Programming vectors and memory management.
* **Compute Bridge**: `Emscripten/WebAssembly (WASM)` for executing binary C++ in a standard web browser without blocking the UI thread.
* **Storage Layer**: `IndexedDB (IDBFS)` for persisting C++ memory changes permanently.
* **Frontend UI**: Vanilla Custom `HTML5`, `CSS3` (Glassmorphism), and `Vanilla JS`.

---

## 📂 2. File Systems & Responsibilities

| File | Purpose |
|------|---------|
| `bus_system.cpp` | The core engine. Handles `Route`, `Ticket`, and `ReservationSystem` classes. Contains zero DOM dependencies. |
| `bus_system.wasm` | The compiled C++ binary executable loaded by the browser network. |
| `app.js` | The bridging script. Mounts the `IDBFS` file system and calls the exposed C++ JSON APIs. |
| `index.html` | The DOM layout containing the sidebar, route cards, seat grid, and dashboard modals. |
| `style.css` | Implements the Premium "Glass/Darkmode" Aesthetic, gradient scaling, and layout grids. |

---

## ⚡ 3. Real-Time Capabilities (The Features)

* **Display Available Routes**: Queries C++ objects for Route IDs, from/to paths, capacity, and fares.
* **Smart Seat Logic**: Live interactive 4-column seat grid matrices. C++ engine prevents duplicate bookings or selections out of bounds.
* **Dynamic Generation**: Automatically generates chronological Ticket IDs (e.g., `T100`, `T101`) during checkout.
* **Ticket Serialization**: Re-integrates ticket verification directly into search arrays.
* **Route Revenue Charts**: Calculates instantaneous live revenue reports via pure C++ vector iteration.

---

## 🛡️ 4. Examination Proofs (For Max Grades)

If evaluated, explicitly demonstrate these core functions to prove the system's robustness:

### A. The Persistence Proof (State Refresh)
1. Book two seats on `Route 1`.
2. Vigorously refresh the browser window (`F5`) multiple times. 
3. Re-open `Route 1`. The seats will remain permanently blacked out. 
> [!NOTE]  
> **How this works**: Emscripten's `IDBFS` intercepts C++ `<fstream>` operations (reading/writing to `/data/tickets.txt`) and seamlessly syncs them to the browser's hidden `IndexedDB` storage via Native APIs upon initialization and modification (`FS.syncfs`).

### B. The Computation Proof (Authentic Logic)
1. Book a ticket. Check the "Revenue Reports" tab.
2. The UI relies entirely on the output of `resSys.getReportsJSON()`. The mathematical aggregation of revenues across all vectors is performed natively in C++ via string serialization, NOT in JavaScript.
3. This proves that reports represent actual bookings and are not hardcoded UI tricks.

### C. The Binary Proof ("This is just JS")
If an examiner requests proof of WebAssembly Execution:
1. Open Chrome Developer Tools (`F12`).
2. Go to the **Network** tab.
3. Hard reload the page.
4. Point out the `bus_system.wasm` file being executed by the browser engine. 
5. Emphasize that there are no standard JS math arrays for booking logic in `app.js`—it solely serves to pipe text data into the embedded C++ memory blocks via `<emscripten/bind.h>`.

---

## 💻 5. Local Compilation Instructions
If you need to change C++ logic and recompile locally, run the following (Requires Emscripten SDK):
```bash
# Enter the Emscripten directory and initialize environments
emcc bus_system.cpp -o bus_system.js -std=c++17 --bind -lidbfs.js
```
*Note: The `-lidbfs.js` flag is hyper-critical as it tells the C++ compiler to allow IndexedDB hooks into standard C++ file streams.*
