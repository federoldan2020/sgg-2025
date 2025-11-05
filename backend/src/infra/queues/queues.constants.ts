export const QUEUE_NAMES = {
  COLATERALES: 'colaterales',
  PADRONES: 'padrones', // ⬅️ NUEVO
  // COMPROBANTES: 'comprobantes',
  // NOTIFICATIONS: 'notifications',
} as const;

export const JOB_NAMES = {
  // Publicaciones / Colaterales
  RECALC_PUBLICACION: 'recalc-colaterales-publicacion',

  // Padrones
  PROPAGAR_J38: 'padrones-propagar-j38', // ⬅️ NUEVO
};
