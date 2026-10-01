export const SAKANI_WORKSPACE = {
  name: "Sakani",
  slug: "sakani",
} as const;

export const DEFAULT_PIPELINE_STAGES = [
  { name: "Baru", position: 1, isTerminal: false },
  { name: "Terkualifikasi", position: 2, isTerminal: false },
  { name: "Survei", position: 3, isTerminal: false },
  { name: "Sudah Survei", position: 4, isTerminal: false },
  { name: "Booking", position: 5, isTerminal: false },
  { name: "Akad", position: 6, isTerminal: false },
  { name: "Closing", position: 7, isTerminal: true },
  { name: "Lost", position: 8, isTerminal: true },
] as const;
