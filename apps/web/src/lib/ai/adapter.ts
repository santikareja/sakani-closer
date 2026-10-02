import type { AiWorkspaceViewModel } from "../../types/ai";

export function createUnavailableAiWorkspace(): AiWorkspaceViewModel {
  return {
    readinessLabel: "Belum siap digunakan",
    readinessDescription:
      "Penyedia, model, pencarian knowledge, dan audit AI belum memiliki kontrak backend aktif.",
    isAvailable: false,
    capabilities: [
      {
        id: "copilot",
        label: "Copilot percakapan",
        state: "unavailable",
        description:
          "Ringkasan, intent, dan saran balasan menunggu penyedia serta dasar pengetahuan.",
        isDemo: false,
        isAvailable: false,
      },
      {
        id: "qualification",
        label: "Kualifikasi lead",
        state: "unavailable",
        description: "Belum ada kontrak untuk profil, skor, atau alasan kualifikasi.",
        isDemo: false,
        isAvailable: false,
      },
      {
        id: "knowledge",
        label: "Knowledge retrieval",
        state: "unavailable",
        description: "Upload, indexing, chunking, dan retrieval belum diaktifkan.",
        isDemo: false,
        isAvailable: false,
      },
    ],
    auditNote:
      "Tidak ada proses AI yang disimulasikan. Aktivitas baru akan muncul setelah audit backend tersedia.",
  };
}
