# Regression checks

Run with Node.js (no dependencies):

```sh
node --test tests/scene-regression.cjs
```

The tests execute the HTML's actual application code, bundled JSNES emulator, and five ROMs in a small DOM/storage harness. They cover cartridge interlocks, startup/reset/ejection, drag cancellation, input release and quick taps, refresh-rate-independent timing, animation cleanup, battery saves, legacy account migration, validation, and storage failures.

The harness does not render CSS or replace browser testing. The accompanying manual pass used the in-app Chromium browser at 320×568, 390×844, 768×1024, 844×390, and 1440×900: login and form validation, console selection, room layout, physical cartridge drag/drop, all five game launches, on-screen controls, and enlarged TV view. Native Safari/Firefox and physical touch devices were not tested.

Accounts and battery-backed game saves remain local to the browser. This standalone page has no account server or email password-recovery service.
