/**
 * Onda de agua al pulsar.
 *
 * Una gota que cae en la superficie: el círculo nace donde tocó el dedo y se
 * expande hasta pasarse del borde. Es el único gesto de toda la tienda que
 * responde al punto exacto del toque, y por eso es el que hace sentir la
 * página cercana en vez de rígida.
 *
 * Va por DOM y no por estado de React: dura 600 ms y montar un componente
 * para eso obligaría a un re-render por cada pulsación.
 */
export function ondaDeAgua(event: { currentTarget: HTMLElement; clientX: number; clientY: number }) {
  const host = event.currentTarget;
  if (
    typeof window === 'undefined' ||
    typeof Element.prototype.animate !== 'function' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const caja = host.getBoundingClientRect();
  // El diámetro cubre la esquina más lejana: así la onda siempre termina de
  // cruzar el botón, se haya pulsado donde se haya pulsado.
  const diametro =
    2 *
    Math.max(
      Math.hypot(event.clientX - caja.left, event.clientY - caja.top),
      Math.hypot(caja.right - event.clientX, event.clientY - caja.top),
      Math.hypot(event.clientX - caja.left, caja.bottom - event.clientY),
      Math.hypot(caja.right - event.clientX, caja.bottom - event.clientY),
    );

  const onda = document.createElement('span');
  onda.setAttribute('aria-hidden', 'true');
  onda.style.cssText = [
    'position:absolute',
    `left:${event.clientX - caja.left - diametro / 2}px`,
    `top:${event.clientY - caja.top - diametro / 2}px`,
    `width:${diametro}px`,
    `height:${diametro}px`,
    'border-radius:50%',
    'background:radial-gradient(circle, rgba(255,255,255,.42) 0%, rgba(255,255,255,.16) 45%, transparent 70%)',
    'pointer-events:none',
    'will-change:transform,opacity',
  ].join(';');

  host.appendChild(onda);

  const animacion = onda.animate(
    [
      { transform: 'scale(0)', opacity: 1 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 600, easing: 'cubic-bezier(.2,.6,.25,1)', fill: 'forwards' },
  );
  animacion.onfinish = () => onda.remove();
  animacion.oncancel = () => onda.remove();
}
