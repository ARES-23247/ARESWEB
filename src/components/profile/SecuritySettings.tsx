import { useState } from "react";
import { Shield, Key, CheckCircle, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "../../utils/auth-client";
import { ProfileSubComponentProps } from "./types";

export function SecuritySettings({ inputClass, labelClass, sectionClass }: ProfileSubComponentProps) {
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [twoFactorData, setTwoFactorData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    setError("");
    setSuccess("");
    try {
      // @ts-expect-error -- BetterAuth extensions
      const { error } = await authClient.emailVerification.sendVerificationEmail({
        email: session?.user.email || "",
        callbackURL: window.location.origin + "/dashboard/profile"
      });
      if (error) throw new Error(error.message || "Failed to send email");
      setSuccess("Verification email sent! Check your inbox.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSendingVerification(false);
    }
  };

  const start2FASetup = async () => {
    setError("");
    try {
      // @ts-expect-error -- BetterAuth extensions
      const { data, error } = await authClient.twoFactor.enable();
      if (error) throw new Error(error.message);
      if (data) {
        // @ts-expect-error -- BetterAuth extensions
        setTwoFactorData({ qrCode: data.totpURI, secret: data.secret });
        setIsSettingUp2FA(true);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const verifyAndEnable2FA = async () => {
    setError("");
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: otpCode
      });
      if (error) throw new Error(error.message);
      
      setSuccess("Two-factor authentication enabled successfully!");
      setIsSettingUp2FA(false);
      setTwoFactorData(null);
      setOtpCode("");
      await refetchSession();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const disable2FA = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This makes your account less secure.")) return;
    setError("");
    try {
      // @ts-expect-error -- BetterAuth extensions
      const { error } = await authClient.twoFactor.disable();
      if (error) throw new Error(error.message);
      setSuccess("Two-factor authentication disabled.");
      await refetchSession();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className={sectionClass}>
      <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2">
        <Shield size={16} /> Security & Authentication
      </h3>

      {/* Email Verification Status */}
      <div className="bg-obsidian/50 border border-white/10 p-4 ares-cut-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${session?.user.emailVerified ? "bg-ares-gold/10 text-ares-gold" : "bg-ares-red/10 text-ares-red"}`}>
            {session?.user.emailVerified ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <p className="text-sm font-bold text-white">Email Verification</p>
            <p className="text-xs text-marble/50">
              {session?.user.emailVerified 
                ? "Your email address has been verified." 
                : "Your email address is not yet verified."}
            </p>
          </div>
        </div>
        {!session?.user.emailVerified && (
          <button 
            onClick={handleSendVerification}
            disabled={isSendingVerification}
            className="px-4 py-2 bg-ares-red/10 border border-ares-red/30 text-ares-red text-xs font-bold ares-cut-sm hover:bg-ares-red hover:text-white transition-all disabled:opacity-50"
          >
            {isSendingVerification ? <RefreshCw size={14} className="animate-spin" /> : "Verify Now"}
          </button>
        )}
      </div>

      {/* 2FA Status */}
      <div className="bg-obsidian/50 border border-white/10 p-4 ares-cut-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${session?.user?.twoFactorEnabled ? "bg-ares-gold/10 text-ares-gold" : "bg-black/40 text-marble/40"}`}>
              <Key size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Two-Factor Authentication (2FA)</p>
              <p className="text-xs text-marble/50">
                {session?.user?.twoFactorEnabled 
                  ? "Active: Your account is protected with TOTP." 
                  : "Inactive: Add an extra layer of security to your account."}
              </p>
            </div>
          </div>
          {!session?.user?.twoFactorEnabled ? (
            <button 
              onClick={start2FASetup}
              className="px-4 py-2 bg-white text-black text-xs font-bold ares-cut-sm hover:bg-ares-red hover:text-white transition-all"
            >
              Setup 2FA
            </button>
          ) : (
            <button 
              onClick={disable2FA}
              className="px-4 py-2 bg-ares-red/10 border border-ares-red/30 text-ares-red text-xs font-bold ares-cut-sm hover:bg-ares-red hover:text-white transition-all"
            >
              Disable
            </button>
          )}
        </div>

        {/* 2FA Setup Flow */}
        {isSettingUp2FA && twoFactorData && (
          <div className="mt-4 p-4 border-t border-white/10 space-y-6 pt-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="bg-white p-2 ares-cut-sm">
                <QRCodeSVG value={twoFactorData.qrCode} size={160} />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-xs text-marble/40 font-medium">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.). 
                  If you can&apos;t scan it, enter the secret key manually:
                </p>
                <div className="flex items-center gap-2 bg-obsidian border border-white/10 p-2 ares-cut-sm">
                  <code className="text-ares-gold text-xs font-mono flex-1 truncate">{twoFactorData.secret}</code>
                  <button 
                    onClick={() => {
                        navigator.clipboard.writeText(twoFactorData.secret);
                        setSuccess("Secret copied!");
                        setTimeout(() => setSuccess(""), 2000);
                    }}
                    className="text-marble/50 hover:text-white p-1"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="2fa-otp" className={labelClass}>Verification Code</label>
              <div className="flex gap-2">
                <input 
                  id="2fa-otp"
                  type="text" 
                  className={inputClass} 
                  placeholder="000000" 
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  maxLength={6}
                />
                <button 
                  onClick={verifyAndEnable2FA}
                  className="px-6 bg-ares-gold text-black font-bold ares-cut-sm hover:bg-ares-gold/80 transition-all"
                >
                  Confirm
                </button>
                <button 
                  onClick={() => setIsSettingUp2FA(false)}
                  className="px-4 border border-white/20 text-marble/40 font-bold ares-cut-sm hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-ares-red font-bold animate-pulse">{error}</p>}
      {success && <p className="text-xs text-ares-gold font-bold">{success}</p>}
    </div>
  );
}
