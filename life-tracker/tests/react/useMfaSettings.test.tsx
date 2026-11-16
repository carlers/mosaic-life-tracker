import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const provider = vi.hoisted(() => ({
  getMfaAccountState: vi.fn(),
  beginTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  createRecoveryCodes: vi.fn(),
  activateMfa: vi.fn(),
}));
vi.mock("../../src/lib/mfa", () => provider);
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { $id: "mfa_owner" } }),
}));

import { useMfaSettings } from "../../src/hooks/useMfaSettings";

describe("MFA enrollment stays transient and provider-authoritative", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const method of Object.values(provider)) method.mockReset();
    provider.getMfaAccountState.mockResolvedValue({
      userId: "mfa_owner", enabled: false, hasTotp: false,
    });
  });
  afterEach(() => localStorage.clear());

  it("requires a verified authenticator, recovery codes and acknowledgment", async () => {
    const { result } = renderHook(() => useMfaSettings(true));
    await waitFor(() => expect(result.current.stage).toBe("off"));
    provider.beginTotpEnrollment.mockResolvedValue({
      secret: "BASE32PRIVATE", uri: "otpauth://totp/Mosaic?secret=BASE32PRIVATE",
    });
    await act(async () => { await result.current.begin(); });
    expect(result.current.stage).toBe("pairing");
    expect(result.current.setup?.secret).toBe("BASE32PRIVATE");

    provider.confirmTotpEnrollment.mockRejectedValueOnce(new Error("Bad code"));
    await act(async () => { await result.current.verify("000000"); });
    expect(result.current.stage).toBe("pairing");
    expect(provider.createRecoveryCodes).not.toHaveBeenCalled();
    provider.confirmTotpEnrollment.mockResolvedValueOnce({});
    await act(async () => { await result.current.verify("012345"); });
    expect(result.current.stage).toBe("readyForCodes");
    expect(result.current.setup).toBeNull();

    provider.createRecoveryCodes.mockResolvedValueOnce(["backup-A", "backup-B"]);
    await act(async () => { await result.current.generateCodes(); });
    expect(result.current.stage).toBe("codes");
    await act(async () => { await result.current.enable(); });
    expect(provider.activateMfa).not.toHaveBeenCalled();
    act(() => result.current.setAcknowledged(true));
    provider.activateMfa.mockResolvedValueOnce(true);
    await act(async () => { await result.current.enable(); });
    expect(result.current.stage).toBe("on");
    expect(result.current.codes).toEqual([]);
    expect(localStorage.getItem("BASE32PRIVATE")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("backup-A");
  });

  it("clears setup secrets and recovery codes on close without enabling", async () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useMfaSettings(isOpen),
      { initialProps: { isOpen: true } },
    );
    await waitFor(() => expect(result.current.stage).toBe("off"));
    provider.beginTotpEnrollment.mockResolvedValue({
      secret: "hidden", uri: "otpauth://totp/test?secret=hidden",
    });
    await act(async () => { await result.current.begin(); });
    expect(result.current.setup?.secret).toBe("hidden");
    rerender({ isOpen: false });
    await waitFor(() => expect(result.current.setup).toBeNull());
    expect(result.current.codes).toEqual([]);
    expect(provider.activateMfa).not.toHaveBeenCalled();
  });

  it("reopens a verified but not enabled TOTP enrollment at recovery preparation", async () => {
    provider.getMfaAccountState.mockResolvedValue({
      userId: "mfa_owner", enabled: false, hasTotp: true,
    });
    const { result } = renderHook(() => useMfaSettings(true));
    await waitFor(() => expect(result.current.stage).toBe("readyForCodes"));
    expect(provider.beginTotpEnrollment).not.toHaveBeenCalled();
  });
});
