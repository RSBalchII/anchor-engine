// Nanobot service stub - not implemented yet
export const nanobotService = {
  sendMessage: async (message: string) => {
    console.log('[Nanobot] Message sent:', message);
    return { response: 'Nanobot not implemented' };
  }
};
