# Mobile Web Push setup and verification

Mosaic uses **standards-based VAPID Web Push** with its existing Appwrite
`message-action` Function and PWA service worker. There is no Firebase
project, Apple Developer account, separate push server, or new Function.
The in-app Alerts feed remains operational even when push is disabled.

## Device setup

**Android (Chrome or another browser supporting installed PWA push):**
1. Open the intended Mosaic deployment over HTTPS in Chrome, sign in, and use
   the browser menu → **Install app** / **Add to Home screen**.
2. Launch Mosaic (preferably the installed app), open **Settings → Notifications**
   (or Alerts → gear), and turn on **Push friend completions**.
3. Approve the browser/OS notification permission. Ensure Mosaic's notifications
   are allowed in Android Settings → Apps → Mosaic/Chrome → Notifications.
4. Keep that installed app/account signed in. An accepted friend must complete
   a *new shared task* to send a push; historic/imported/private tasks do not.

**iPhone/iPad (iOS/iPadOS 16.4 or later):**
1. In Safari, open the intended Mosaic HTTPS deployment. Tap **Share → Add to
   Home Screen**, then **Add**. A normal Safari tab cannot subscribe to iOS
   Home Screen Web Push.
2. **Launch Mosaic from the Home Screen icon**, sign in, go to
   **Settings → Notifications**, and turn on **Push friend completions**.
3. Tap **Allow** at the system prompt. Check **Settings → Notifications →
   Mosaic** (and Focus / Scheduled Summary, if applicable) if delivery is quiet.
4. Use a second accepted friend's account to complete a new shared task.

Push is *per installed app/browser profile and device*, not a synced account
preference. The **Show task details in notifications** switch appears only after
push is enabled and the server verifies this device's subscription preference.
It is off by default. Turning it on allows the friend's display name and task
title to appear on your lock screen; turning it off cannot remove information
already delivered. Keep it off on shared/unsecured phones. Enable it separately on each phone. Production and Preview are
different origins: a subscription from one installation is not the other's
subscription. If the switch says "Install Mosaic to your Home Screen first",
open the installed icon; if it says "Blocked", re-enable notification access in
OS/browser settings. Close and reopen Mosaic after installing a PWA update if
it is still running an old service worker.

## Foreground notifications

**Notify while Mosaic is open** is a browser-profile setting on a subscribed
Chromium device (including Android Chrome/Samsung browsers); it defaults to on.
Turn it off to suppress a *system* completion notification while a Mosaic
window on this same origin is visibly active. The service worker still displays
background pushes and the server-owned Alerts history is unchanged. Other
browser engines, including iOS Safari/WebKit, require Web Push to display a
notification for every push event; their foreground switch is disabled rather
than risking subscription revocation. This is not an in-app toast preference.
See [Chromium's visible-tab exemption](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/push_messaging/push_messaging_notification_manager.cc)
and [Apple's visibility requirement](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
An installed Android/Samsung PWA must be tested for actual OS notification
behavior with the app visibly open, backgrounded, and fully closed.

A grey **Show task details in notifications** switch accompanied by
"Requires Appwrite notification backend update" means the optional
`get_push_details` action and schema migration `006-push-details` have
not been activated on the Appwrite project used by that deployment.
The client does not silently enable rich lock-screen text. Keep the Function
and schema rollout gated and validate in the scratch project first.

## Server setup / security

The Function already declares **optional** configuration keys:
`WEB_PUSH_VAPID_PUBLIC_KEY` (nonsecret),
`WEB_PUSH_VAPID_PRIVATE_KEY` (**secret**),
and `WEB_PUSH_VAPID_SUBJECT` (nonsecret HTTPS URL or mailto contact).
Only configure these with explicit Appwrite project targeting and ensure the
public/private values belong to the same P-256 VAPID key pair. Never put the
private key in Git, Vercel's client environment, an issue, a screenshot,
documentation, or a browser bundle. Rotate only deliberately: an existing
browser PushSubscription must then be unsubscribed/re-subscribed to the new
application server key. Keep scratch and production keys separate.

After provisioning, verify the authenticated `get_push_config` action reports
`enabled: true` with only a public key; check Function variable secrecy without
reading the private value. Use a disposable, mutually accepted pair to test
actual delivery (lock screen and notification tap, app foreground/background).
A tap should open the installed PWA where the browser supports it, navigate to
the exact receipt, and open the focused Friend Day View. Test cold-start,
background/foreground, no cached page, older paginated receipts, sign-out,
account switch, expired/private tasks, and denied/revoked friendship.
The `006-push-details` backend migration must be applied before the new Function
becomes active. Client/Function rolling deploys remain compatible: an old
Function cannot enable the detail switch. Production activation is separate
from pushing frontend code.
Push requests are driven by eligible Appwrite task-completion events. The
payload intentionally excludes private task text and is discarded in the
service worker unless the local active account matches its intended account.
Unsubscribe through the device's Notifications switch; account marker is
also cleared during sign-out. A successful `get_push_config` check alone
**does not prove remote Push delivery on any particular phone**.

Web Push may be delayed/suppressed by browser power saving, Focus modes,
notification permissions or push service availability. The Alerts activity
feed is the durable source of truth and is not dependent on delivery.
