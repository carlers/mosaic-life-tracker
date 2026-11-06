import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { $id: "new_owner", email: "new@example.com" },
    requestEmailVerification: mocks.send,
  }),
}));
import { SignupEmailVerificationPrompt } from "../../src/components/modals/SignupEmailVerificationPrompt";

describe("optional post-signup email verification", () => {
  beforeEach(() => {
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.dismiss.mockReset();
  });

  it("shows a brief reason and never sends automatically", async () => {
    render(<SignupEmailVerificationPrompt onDismiss={mocks.dismiss} />);
    expect(await screen.findByText(/Confirm this address belongs to you/)).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Maybe later" }));
    expect(mocks.dismiss).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends only once on opt-in and offers a way back into Mosaic", async () => {
    render(<SignupEmailVerificationPrompt onDismiss={mocks.dismiss} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send verification email" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Verification email sent");
    expect(screen.queryByRole("button", { name: "Send verification email" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Mosaic" }));
    expect(mocks.dismiss).toHaveBeenCalledOnce();
  });

  it("keeps a dismiss option when the server rate-limits sending", async () => {
    mocks.send.mockRejectedValue({ code: 429 });
    render(<SignupEmailVerificationPrompt onDismiss={mocks.dismiss} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send verification email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Maybe later" })).toBeEnabled();
    expect(mocks.dismiss).not.toHaveBeenCalled();
  });
});
