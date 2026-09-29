import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "../../src/pages/AuthPage";
import { ResetPasswordPage } from "../../src/pages/ResetPasswordPage";

const auth = vi.hoisted(() => ({
  user: null,
  login: vi.fn(),
  signup: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  completePasswordRecovery: vi.fn(),
  isLoading: false,
  error: null as string | null,
  recoveryLoading: false,
  recoveryError: null as string | null,
  recoverySuccess: null as "requested" | "completed" | null,
}));

vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => auth }));

describe("password recovery pages", () => {
  beforeEach(() => {
    auth.requestPasswordRecovery.mockReset().mockResolvedValue(true);
    auth.completePasswordRecovery.mockReset().mockResolvedValue(true);
    auth.recoveryLoading = false;
    auth.recoveryError = null;
    auth.recoverySuccess = null;
  });

  it("opens the accessible recovery form from login and submits the email", async () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email Address" }), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );
    await waitFor(() =>
      expect(auth.requestPasswordRecovery).toHaveBeenCalledWith(
        "person@example.com",
      ),
    );
  });

  it("shows a generic request confirmation and an accessible pending state", () => {
    auth.recoverySuccess = "requested";
    const { unmount } = render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "If an account exists",
    );
    unmount();
    auth.recoverySuccess = null;
    auth.recoveryLoading = true;
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    const pendingButton = screen.getByRole("button", { name: "Sending…" });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton.closest("form")).toHaveAttribute("aria-busy", "true");
  });

  it("rejects missing callback parameters and mismatched passwords", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "invalid or incomplete",
    );
    unmount();
    render(
      <MemoryRouter initialEntries={["/reset-password?userId=u1&secret=s1"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "password1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "password2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match",
    );
    expect(auth.completePasswordRecovery).not.toHaveBeenCalled();
  });

  it("shows API errors and provides a return to login after success", () => {
    auth.recoveryError = "Expired recovery link";
    const { unmount } = render(
      <MemoryRouter initialEntries={["/reset-password?userId=u1&secret=s1"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Expired recovery link",
    );
    unmount();
    auth.recoveryError = null;
    auth.recoverySuccess = "completed";
    render(
      <MemoryRouter initialEntries={["/reset-password?userId=u1&secret=s1"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Return to login" }));
    expect(screen.getByText("Login destination")).toBeInTheDocument();
  });
});
