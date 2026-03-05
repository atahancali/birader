import type { AppLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n";

export type ApiErrorModel = {
  code: string;
  message: string;
  hint: string;
  rawMessage: string;
  rawCode: string;
};

type NormalizeApiErrorOptions = {
  lang: AppLang;
  fallbackTr?: string;
  fallbackEn?: string;
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  hint?: unknown;
  details?: unknown;
  status?: unknown;
  error_description?: unknown;
};

const SCHEMA_HINT_TR = "Supabase SQL Editor'de scripts/sql/main.sql çalıştırip sayfayi yenile.";
const SCHEMA_HINT_EN = "Run scripts/sql/main.sql in Supabase SQL Editor and refresh the page.";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function extractErrorLike(error: unknown): ErrorLike {
  if (!error || typeof error !== "object") return {};
  return error as ErrorLike;
}

function extractRawMessage(error: unknown, fallback: string) {
  const obj = extractErrorLike(error);
  return (
    asText(obj.message) ||
    asText(obj.error_description) ||
    asText(obj.details) ||
    (typeof error === "string" ? error : "") ||
    fallback
  );
}

function extractRawCode(error: unknown) {
  const obj = extractErrorLike(error);
  return asText(obj.code || obj.status || "");
}

function mapErrorCode(rawCode: string, rawMessageLower: string) {
  if (rawCode === "23505" || rawMessageLower.includes("duplicate")) return "DUPLICATE";
  if (rawCode === "23503") return "FK_CONSTRAINT";
  if (rawCode === "22P02") return "INVALID_INPUT";
  if (rawCode === "42501" || rawMessageLower.includes("row-level security")) return "FORBIDDEN_RLS";
  if (rawMessageLower.includes("network request failed") || rawMessageLower.includes("failed to fetch") || rawMessageLower.includes("load failed")) {
    return "NETWORK_ERROR";
  }
  if (
    rawMessageLower.includes("does not exist") ||
    rawMessageLower.includes("relation") ||
    rawMessageLower.includes("column") ||
    rawMessageLower.includes("policy")
  ) {
    return "SCHEMA_OUTDATED";
  }
  if (rawMessageLower.includes("jwt") || rawMessageLower.includes("auth") || rawMessageLower.includes("unauthorized")) {
    return "AUTH_REQUIRED";
  }
  return "UNKNOWN_ERROR";
}

function messageForCode(code: string, lang: AppLang, rawMessage: string, fallbackTr: string, fallbackEn: string) {
  switch (code) {
    case "NETWORK_ERROR":
      return {
        message: tx(lang, "Ağ bağlantısı kurulamadığı için işlem tamamlanamadı.", "The action failed because the network request could not be completed."),
        hint: tx(lang, "Baglantini kontrol edip tekrar dene.", "Check your connection and try again."),
      };
    case "SCHEMA_OUTDATED":
      return {
        message: tx(lang, "Veritabani semasi güncel degil.", "Database schema is outdated."),
        hint: tx(lang, SCHEMA_HINT_TR, SCHEMA_HINT_EN),
      };
    case "FORBIDDEN_RLS":
      return {
        message: tx(lang, "Bu işlem için yetkin yok.", "You do not have permission for this action."),
        hint: tx(lang, "Hesap/rol ve RLS policy ayarlarini kontrol et.", "Check account role and RLS policy settings."),
      };
    case "DUPLICATE":
      return {
        message: tx(lang, "Ayni kayıt zaten mevcut.", "This record already exists."),
        hint: tx(lang, "Mevcut kaydi güncelleyebilir veya farklı bir deger deneyebilirsin.", "You can update the existing record or try a different value."),
      };
    case "FK_CONSTRAINT":
      return {
        message: tx(lang, "İlişkili kayıt bulunamadığı için işlem tamamlanamadı.", "The action failed because a related record is missing."),
        hint: tx(lang, "Referans verilen kayıtlarin var oldugunu doğrula.", "Verify referenced records exist."),
      };
    case "INVALID_INPUT":
      return {
        message: tx(lang, "Gönderilen veri formati gecersiz.", "The submitted data format is invalid."),
        hint: tx(lang, "Alan degerlerini kontrol edip tekrar dene.", "Check field values and try again."),
      };
    case "AUTH_REQUIRED":
      return {
        message: tx(lang, "Bu işlem için tekrar giriş yapman gerekiyor.", "You need to sign in again for this action."),
        hint: tx(lang, "Oturumu yenileyip tekrar dene.", "Refresh your session and try again."),
      };
    default:
      return {
        message: rawMessage || tx(lang, fallbackTr, fallbackEn),
        hint: tx(lang, "Tekrar dene; sorun surerse destekle iletisim kur.", "Retry the action; if it continues, contact support."),
      };
  }
}

export function normalizeApiError(error: unknown, options: NormalizeApiErrorOptions): ApiErrorModel {
  const fallbackTr = options.fallbackTr || "Islem başarısız.";
  const fallbackEn = options.fallbackEn || "Action failed.";
  const fallback = tx(options.lang, fallbackTr, fallbackEn);

  const rawMessage = extractRawMessage(error, fallback);
  const rawCode = extractRawCode(error);
  const code = mapErrorCode(rawCode, rawMessage.toLowerCase());
  const mapped = messageForCode(code, options.lang, rawMessage, fallbackTr, fallbackEn);

  return {
    code,
    message: mapped.message,
    hint: mapped.hint,
    rawMessage,
    rawCode,
  };
}

export function formatApiErrorText(model: ApiErrorModel) {
  return `[${model.code}] ${model.message}${model.hint ? ` • ${model.hint}` : ""}`;
}
