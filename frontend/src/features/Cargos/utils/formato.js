const formatoBs = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 });

export const formatearMonto = (valor) => (valor === null || valor === undefined ? null : formatoBs.format(Number(valor)));
