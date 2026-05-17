import { HttpError } from "./http";

type InputObject = Record<string, unknown>;

export const readObject = (value: unknown) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Payload invalido.");
  }

  return value as InputObject;
};

export const readRequiredString = (source: InputObject, key: string, label: string) => {
  const value = source[key];
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} deve ser texto.`);
  }

  return value.trim();
};

export const readOptionalString = (source: InputObject, key: string, label: string) => {
  const value = source[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${label} deve ser texto.`);
  }

  return value;
};

export const readNullableString = (source: InputObject, key: string, label: string) => {
  const value = source[key];
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${label} deve ser texto.`);
  }

  return value;
};

export const readNullableInteger = (source: InputObject, key: string, label: string) => {
  const value = source[key];
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `${label} invalido.`);
  }

  return value;
};

export const readStringArray = (
  source: InputObject,
  key: string,
  label: string,
  options: { maxItems: number; maxLength: number }
) => {
  const value = source[key];
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label} deve ser uma lista de textos.`);
  }

  if (value.length > options.maxItems) {
    throw new HttpError(400, `${label} deve ter no maximo ${options.maxItems} itens.`);
  }

  return value
    .map((item) => {
      if (typeof item !== "string") {
        throw new HttpError(400, `${label} deve conter apenas textos.`);
      }

      const normalized = item.trim();
      if (normalized.length > options.maxLength) {
        throw new HttpError(400, `${label} deve ter itens com no maximo ${options.maxLength} caracteres.`);
      }

      return normalized;
    })
    .filter(Boolean);
};
