export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const assert = (condition: unknown, status: number, message: string) => {
  if (!condition) {
    throw new HttpError(status, message);
  }
};
