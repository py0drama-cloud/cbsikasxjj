export const PREMIUM_PRICE_STARS = 1000;

export const BOOST_PACKAGES = [
  { id: "boost_24h", label: "24 часа", price: 100, durationHours: 24 },
  { id: "boost_3d", label: "3 дня", price: 250, durationHours: 72 },
  { id: "boost_7d", label: "7 дней", price: 600, durationHours: 168 },
] as const;

export type BoostPackageId = (typeof BOOST_PACKAGES)[number]["id"];

export function getBoostPackage(id: string) {
  return BOOST_PACKAGES.find((item) => item.id === id) || null;
}
