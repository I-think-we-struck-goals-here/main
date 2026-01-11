export const MONZO_BASE_URL =
  "https://monzo.me/zacharysolomanadelmanellis/10.00?h=cBXoQJ";

export const poundsToPence = (amount: number | string) => {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  return Math.round(numeric * 100);
};

export const penceToPounds = (amountPence: number) =>
  (amountPence / 100).toFixed(2);

export const formatGbp = (amountPence: number) =>
  `£${penceToPounds(amountPence)}`;

export const formatSignedGbp = (amountPence: number) =>
  amountPence < 0
    ? `-£${penceToPounds(Math.abs(amountPence))}`
    : `£${penceToPounds(amountPence)}`;

export const splitMatchCost = (
  totalPence: number,
  players: { playerId: number; handle: string }[]
) => {
  if (players.length === 0) {
    return [];
  }

  const ordered = [...players].sort((a, b) =>
    a.handle.localeCompare(b.handle)
  );
  const shareFloor = Math.floor(totalPence / ordered.length);
  const remainder = totalPence - shareFloor * ordered.length;

  return ordered.map((player, index) => ({
    playerId: player.playerId,
    sharePence: shareFloor + (index < remainder ? 1 : 0),
  }));
};

export const buildMonzoLink = (amountPence: number) => {
  const url = new URL(MONZO_BASE_URL);
  const pathParts = url.pathname.split("/");
  pathParts[pathParts.length - 1] = penceToPounds(amountPence);
  url.pathname = pathParts.join("/");
  return url.toString();
};
