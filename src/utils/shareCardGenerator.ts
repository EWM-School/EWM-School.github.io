import QRCode from 'qrcode';
import type { Flashcard } from '../types/flashcard';
import { getCardPhonetics } from './phonetics';

export const OFFICIAL_EWM_URL = 'https://ewm-school.github.io/';
export const OFFICIAL_EWM_STUDY_URL = 'https://ewm-school.github.io/?study=1';

export type ShareFormat = 'story' | 'post';
export type ShareVisualStyle = 'emerald' | 'editorial';

export type ShareCardPayload =
  | {
      kind: 'flashcard';
      card: Flashcard;
    }
  | {
      kind: 'quiz';
      score: number;
      totalAnswered: number;
      featuredCard?: Flashcard | null;
    }
  | {
      kind: 'ranking';
      studentName: string;
      rank: number;
      score: number;
      cardsReviewed: number;
      activeDays: number;
      studyTimeFormatted: string;
      monthName: string;
    };

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let truncated = rest;
        while (truncated.length > 3 && ctx.measureText(`${truncated}…`).width > maxWidth) {
          truncated = truncated.slice(0, -1).trimEnd();
        }
        lines.push(truncated === rest ? rest : `${truncated}…`);
        return lines;
      }
    }
  }

  lines.push(current);
  return lines.slice(0, maxLines);
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function buildWhatsAppShareText(payload: ShareCardPayload): string {
  if (payload.kind === 'flashcard') {
    const translation = payload.card.colloquial[0] || payload.card.literal;
    return [
      `🇺🇸🇬🇧 *Expressão do dia no EWM · Keep practicing:*`,
      ``,
      `✨ *"${payload.card.term}"*`,
      `💬 No dia a dia: *${translation}*`,
      `🗣️ Exemplo: _"${payload.card.exampleEn}"_`,
      ``,
      `Pratique inglês real com áudio nativo US & UK gratuitamente:`,
      `👉 ${OFFICIAL_EWM_URL}`,
    ].join('\n');
  }

  if (payload.kind === 'quiz') {
    const pct =
      payload.totalAnswered > 0
        ? Math.round((payload.score / payload.totalAnswered) * 100)
        : 100;
    return [
      `🎯 *Modo Quiz concluído no EWM · Keep practicing!*`,
      ``,
      `✅ Placar: *${payload.score}/${payload.totalAnswered} acertos (${pct}%)*`,
      payload.featuredCard
        ? `💡 Destaque: *"${payload.featuredCard.term}"* → ${payload.featuredCard.colloquial[0] || payload.featuredCard.literal}`
        : `🔥 Praticando expressões reais em inglês americano e britânico!`,
      ``,
      `Vem testar seu inglês também:`,
      `👉 ${OFFICIAL_EWM_URL}`,
    ].join('\n');
  }

  const rankLabel = payload.rank > 0 ? `#${payload.rank} no Ranking de ${payload.monthName}` : `Praticando em ${payload.monthName}`;
  return [
    `🏆 *Minha evolução no EWM · Keep practicing!*`,
    ``,
    `🥇 *${rankLabel}*`,
    `⭐ *${payload.score.toLocaleString('pt-BR')} pontos* · ${payload.cardsReviewed} cards · ${payload.activeDays} ${payload.activeDays === 1 ? 'dia ativo' : 'dias ativos'} (${payload.studyTimeFormatted})`,
    ``,
    `Bora praticar inglês real juntos com a Teacher Mariana:`,
    `👉 ${OFFICIAL_EWM_URL}`,
  ].join('\n');
}

export async function renderShareCardBlob(
  payload: ShareCardPayload,
  format: ShareFormat = 'story',
  style: ShareVisualStyle = 'emerald'
): Promise<{ blob: Blob; dataUrl: string; filename: string }> {
  const width = 1080;
  const height = format === 'story' ? 1920 : 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D não disponível neste navegador.');
  }

  const isEmerald = style === 'emerald';

  // 1. Background Canvas Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isEmerald) {
    bgGrad.addColorStop(0, '#163833');
    bgGrad.addColorStop(0.52, '#21554E');
    bgGrad.addColorStop(1, '#132D29');
  } else {
    bgGrad.addColorStop(0, '#F7F5F0');
    bgGrad.addColorStop(0.6, '#EFECE3');
    bgGrad.addColorStop(1, '#E5DFD3');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative glow circles
  ctx.save();
  ctx.globalAlpha = isEmerald ? 0.14 : 0.35;
  ctx.fillStyle = isEmerald ? '#68B4A8' : '#CFE2DE';
  ctx.beginPath();
  ctx.arc(width - 120, 180, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(140, height - 220, 290, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Load official EWM logo & generate crisp QR Code in parallel
  const logoUrl = `${import.meta.env.BASE_URL}ewm-logo.jpg`;
  const qrDataUrlPromise = QRCode.toDataURL(OFFICIAL_EWM_URL, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#183E38',
      light: '#FFFFFF',
    },
  });

  const [logoImg, qrDataUrl] = await Promise.all([
    loadImageSafe(logoUrl),
    qrDataUrlPromise,
  ]);
  const qrImg = await loadImageSafe(qrDataUrl);

  const padX = 76;
  const topY = format === 'story' ? 120 : 68;
  const footerHeight = 250;
  const footerY = height - (format === 'story' ? 130 : 72) - footerHeight;

  // 2. Top Brand Header Lockup
  const logoSize = 86;
  drawRoundedRect(ctx, padX, topY, logoSize, logoSize, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, padX + 6, topY + 6, logoSize - 12, logoSize - 12, 16);
    ctx.clip();
    ctx.drawImage(logoImg, padX + 6, topY + 6, logoSize - 12, logoSize - 12);
    ctx.restore();
  } else {
    ctx.fillStyle = '#28665E';
    ctx.font = '800 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EWM', padX + logoSize / 2, topY + logoSize / 2);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = isEmerald ? '#FFFFFF' : '#1C1B18';
  ctx.font = '800 34px Georgia, "Times New Roman", serif';
  ctx.fillText('EWM · Keep practicing', padX + logoSize + 24, topY + 42);

  ctx.fillStyle = isEmerald ? '#B5DFD8' : '#28665E';
  ctx.font = '600 23px system-ui, -apple-system, sans-serif';
  ctx.fillText('English With Mariana · Vozes Nativas US & UK', padX + logoSize + 24, topY + 75);

  // 3. Center Editorial Feature Card
  const cardY = topY + logoSize + (format === 'story' ? 58 : 38);
  const cardHeight = footerY - cardY - (format === 'story' ? 48 : 34);
  const cardWidth = width - padX * 2;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 28, 25, 0.22)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  drawRoundedRect(ctx, padX, cardY, cardWidth, cardHeight, 44);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isEmerald ? 'rgba(255,255,255,0.2)' : '#E2DDD3';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, padX, cardY, cardWidth, cardHeight, 44);
  ctx.stroke();

  const innerX = padX + 60;
  const innerMaxW = cardWidth - 120;
  let cursorY = cardY + (format === 'story' ? 74 : 54);

  if (payload.kind === 'flashcard') {
    const phonetics = getCardPhonetics(payload.card);
    const pillText = `${payload.card.category.toUpperCase()}  ·  ${payload.card.subtopic.toUpperCase()}`;

    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    const pillW = Math.min(innerMaxW, ctx.measureText(pillText).width + 44);
    drawRoundedRect(ctx, innerX, cursorY, pillW, 48, 24);
    ctx.fillStyle = '#EAF3F1';
    ctx.fill();
    ctx.fillStyle = '#225851';
    ctx.fillText(pillText, innerX + 22, cursorY + 32);

    cursorY += format === 'story' ? 112 : 88;

    // English Expression
    const termFontSize = payload.card.term.length > 26 ? 56 : payload.card.term.length > 16 ? 66 : 76;
    ctx.font = `800 ${termFontSize}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = '#1C1B18';
    const termLines = wrapTextLines(ctx, payload.card.term, innerMaxW, 3);
    for (const line of termLines) {
      ctx.fillText(line, innerX, cursorY);
      cursorY += termFontSize * 1.16;
    }

    cursorY += 8;

    // US & UK Phonetics
    ctx.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#28665E';
    const phonLine = `🇺🇸 US ${phonetics.us}   ·   🇬🇧 UK ${phonetics.uk}`;
    const phonWrapped = wrapTextLines(ctx, phonLine, innerMaxW, 2);
    for (const line of phonWrapped) {
      ctx.fillText(line, innerX, cursorY);
      cursorY += 38;
    }

    // Divider
    cursorY += format === 'story' ? 28 : 16;
    ctx.fillStyle = '#ECE7DD';
    ctx.fillRect(innerX, cursorY, innerMaxW, 2);
    cursorY += format === 'story' ? 50 : 36;

    // Natural Brazilian Translation
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#787368';
    ctx.fillText('COMO FALAMOS NO DIA A DIA', innerX, cursorY);
    cursorY += format === 'story' ? 54 : 46;

    const mainMeaning = payload.card.colloquial[0] || phonetics.meaning;
    ctx.font = '800 44px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#1E4E47';
    const meaningLines = wrapTextLines(ctx, mainMeaning, innerMaxW, 2);
    for (const line of meaningLines) {
      ctx.fillText(line, innerX, cursorY);
      cursorY += 54;
    }

    cursorY += format === 'story' ? 30 : 18;

    // Real-life Example Box
    const exBoxH = format === 'story' ? 235 : 175;
    const exBoxY = Math.min(cursorY, cardY + cardHeight - exBoxH - 46);
    drawRoundedRect(ctx, innerX, exBoxY, innerMaxW, exBoxH, 28);
    ctx.fillStyle = '#F7F5F0';
    ctx.fill();

    ctx.font = '600 28px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#1C1B18';
    const enLines = wrapTextLines(ctx, `“${payload.card.exampleEn}”`, innerMaxW - 64, 2);
    let exY = exBoxY + (format === 'story' ? 56 : 46);
    for (const l of enLines) {
      ctx.fillText(l, innerX + 32, exY);
      exY += 38;
    }

    exY += 10;
    ctx.font = '600 25px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#28665E';
    const ptLines = wrapTextLines(ctx, `→ ${payload.card.examplePt}`, innerMaxW - 64, 2);
    for (const l of ptLines) {
      ctx.fillText(l, innerX + 32, exY);
      exY += 34;
    }
  } else if (payload.kind === 'quiz') {
    const accuracy =
      payload.totalAnswered > 0
        ? Math.round((payload.score / payload.totalAnswered) * 100)
        : 100;

    drawRoundedRect(ctx, innerX, cursorY, 320, 50, 25);
    ctx.fillStyle = '#FEF3C7';
    ctx.fill();
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#B45309';
    ctx.fillText('🎯 DESAFIO MODO QUIZ', innerX + 24, cursorY + 33);

    cursorY += format === 'story' ? 128 : 96;

    ctx.font = '900 112px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#28665E';
    ctx.fillText(`${accuracy}%`, innerX, cursorY);

    cursorY += 56;
    ctx.font = '800 44px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#1C1B18';
    ctx.fillText(
      `${payload.score} de ${payload.totalAnswered} acertos no inglês real!`,
      innerX,
      cursorY
    );

    cursorY += format === 'story' ? 62 : 44;
    ctx.fillStyle = '#ECE7DD';
    ctx.fillRect(innerX, cursorY, innerMaxW, 2);
    cursorY += format === 'story' ? 58 : 42;

    if (payload.featuredCard) {
      ctx.font = '700 23px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#787368';
      ctx.fillText('EXPRESSÃO PRATICADA NA SESSÃO', innerX, cursorY);
      cursorY += 52;

      ctx.font = '800 48px Georgia, "Times New Roman", serif';
      ctx.fillStyle = '#1C1B18';
      const fLines = wrapTextLines(ctx, `“${payload.featuredCard.term}”`, innerMaxW, 2);
      for (const l of fLines) {
        ctx.fillText(l, innerX, cursorY);
        cursorY += 56;
      }

      ctx.font = '600 32px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#28665E';
      const mLines = wrapTextLines(
        ctx,
        `→ ${payload.featuredCard.colloquial[0] || payload.featuredCard.literal}`,
        innerMaxW,
        2
      );
      for (const l of mLines) {
        ctx.fillText(l, innerX, cursorY);
        cursorY += 42;
      }
    }
  } else {
    // Ranking / Study Consistency Achievement
    const badgeLabel =
      payload.rank === 1
        ? '🥇 1º LUGAR NO RANKING'
        : payload.rank === 2
        ? '🥈 2º LUGAR NO RANKING'
        : payload.rank === 3
        ? '🥉 3º LUGAR NO RANKING'
        : payload.rank > 0
        ? `🏆 TOP #${payload.rank} DE ${payload.monthName.toUpperCase()}`
        : `🔥 CONSISTÊNCIA EM ${payload.monthName.toUpperCase()}`;

    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    const badgeW = Math.min(innerMaxW, ctx.measureText(badgeLabel).width + 48);
    drawRoundedRect(ctx, innerX, cursorY, badgeW, 52, 26);
    ctx.fillStyle = '#FEF3C7';
    ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.fillText(badgeLabel, innerX + 24, cursorY + 34);

    cursorY += format === 'story' ? 110 : 84;

    ctx.font = '800 54px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#1C1B18';
    const nameLines = wrapTextLines(ctx, payload.studentName, innerMaxW, 2);
    for (const l of nameLines) {
      ctx.fillText(l, innerX, cursorY);
      cursorY += 64;
    }

    cursorY += 16;
    ctx.font = '900 88px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#28665E';
    ctx.fillText(`${payload.score.toLocaleString('pt-BR')} pts`, innerX, cursorY + 46);

    cursorY += format === 'story' ? 118 : 92;

    // 3 Stat Tiles
    const statsGrid = [
      { label: 'CARDS PRATICADOS', val: `${payload.cardsReviewed}` },
      { label: 'DIAS ATIVOS', val: `${payload.activeDays}d` },
      { label: 'DEDICAÇÃO', val: payload.studyTimeFormatted },
    ];
    const tileGap = 22;
    const tileW = (innerMaxW - tileGap * 2) / 3;
    const tileH = format === 'story' ? 175 : 145;

    statsGrid.forEach((st, idx) => {
      const tx = innerX + idx * (tileW + tileGap);
      drawRoundedRect(ctx, tx, cursorY, tileW, tileH, 26);
      ctx.fillStyle = '#F6F4EF';
      ctx.fill();

      ctx.font = '800 44px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#1C1B18';
      ctx.fillText(st.val, tx + 26, cursorY + (format === 'story' ? 80 : 68));

      ctx.font = '700 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#6B655C';
      ctx.fillText(st.label, tx + 26, cursorY + (format === 'story' ? 130 : 112));
    });
  }

  // 4. Bottom QR Code Call-To-Action Strip
  drawRoundedRect(ctx, padX, footerY, cardWidth, footerHeight, 36);
  ctx.fillStyle = isEmerald ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = isEmerald ? 'rgba(255, 255, 255, 0.24)' : '#E2DDD3';
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrBoxSize = 194;
  const qrX = padX + cardWidth - qrBoxSize - 28;
  const qrY = footerY + (footerHeight - qrBoxSize) / 2;

  drawRoundedRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  if (qrImg) {
    ctx.drawImage(qrImg, qrX + 12, qrY + 12, qrBoxSize - 24, qrBoxSize - 24);
  }

  const ctaX = padX + 42;
  ctx.fillStyle = isEmerald ? '#86CEC2' : '#28665E';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('APONTE A CÂMERA OU ACESSE GRÁTIS', ctaX, footerY + 72);

  ctx.fillStyle = isEmerald ? '#FFFFFF' : '#1C1B18';
  ctx.font = '800 40px system-ui, -apple-system, sans-serif';
  ctx.fillText('ewm-school.github.io', ctaX, footerY + 128);

  ctx.fillStyle = isEmerald ? '#DCECE8' : '#5C574E';
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('Flashcards · Quiz · Inglês US & UK Offline', ctaX, footerY + 178);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Falha ao exportar PNG do card.'));
    }, 'image/png');
  });

  const slug =
    payload.kind === 'flashcard'
      ? payload.card.term.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)
      : payload.kind;

  return {
    blob,
    dataUrl,
    filename: `ewm-${slug}-${format}.png`,
  };
}
