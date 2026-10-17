/**
 * receiptExporter.js - 실물 감열지 영수증 고해상도 PNG 이미지 렌더링 & 다운로드 모듈
 */

export class ReceiptExporter {
  static exportAsPNG(receiptData) {
    if (typeof document === 'undefined') return false;

    const {
      payerNames = '당첨자',
      ruleDesc = '꼴찌 1명 몰빵 결제',
      dateStr = '',
      seedCode = '',
      orderItems = [],
      totalAmount = 0,
      perPayerAmount = 0,
      payerCount = 1,
      totalCount = 1,
      winnerName = '-',
      footnote = '* 승패에 승복하고 쿨하게 결제하는 멋진 동료가 됩시다.'
    } = receiptData || {};

    const dpr = 2;
    const width = 420;
    const itemRowsHeight = Math.max(1, orderItems.length) * 28;
    const height = 430 + itemRowsHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. 다크 배경 여백
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. 감열지 영수증 본체
    const rx = 24;
    const ry = 20;
    const rw = width - 48;
    const rh = height - 40;

    ctx.fillStyle = '#FFFDF9';
    ctx.fillRect(rx, ry, rw, rh);

    // 상하단 지그재그 톱니 커팅
    ctx.fillStyle = '#0F172A';
    for (let x = rx; x < rx + rw; x += 14) {
      ctx.beginPath();
      ctx.arc(x + 7, ry, 5, 0, Math.PI, false);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 7, ry + rh, 5, Math.PI, Math.PI * 2, false);
      ctx.fill();
    }

    let cy = ry + 36;

    // 3. 헤더 타이틀
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 20px "Courier New", Pretendard, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('☕ OFFICE DERBY CAFE', width / 2, cy);

    cy += 20;
    ctx.fillStyle = '#64748B';
    ctx.font = '600 11.5px Pretendard, sans-serif';
    ctx.fillText('오피스 더비 사내 커피내기 공식 결제 영수증', width / 2, cy);

    cy += 16;
    ctx.font = '11px monospace';
    ctx.fillText(`${dateStr}${seedCode ? ` | SEED: #${seedCode}` : ''}`, width / 2, cy);

    cy += 14;
    this.drawDashedLine(ctx, rx + 18, rx + rw - 18, cy, '#94A3B8');

    // 4. 결제 당첨자 하이라이트 박스
    cy += 16;
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(rx + 18, cy - 14, rw - 36, 30);

    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 13px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 당첨 결제자', rx + 26, cy + 5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#B91C1C';
    ctx.font = '900 13.5px Pretendard, sans-serif';
    ctx.fillText(`${payerNames}`, rx + rw - 26, cy + 5);

    cy += 32;
    ctx.fillStyle = '#334155';
    ctx.font = '600 12px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('적용 벌칙 룰', rx + 20, cy);
    ctx.textAlign = 'right';
    ctx.fillText(ruleDesc, rx + rw - 20, cy);

    cy += 20;
    ctx.textAlign = 'left';
    ctx.fillText('👑 1위 우승자 (면제)', rx + 20, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px Pretendard, sans-serif';
    ctx.fillText(`${winnerName}님`, rx + rw - 20, cy);

    cy += 14;
    this.drawDashedLine(ctx, rx + 18, rx + rw - 18, cy, '#CBD5E1');

    // 5. 주문 내역 헤더
    cy += 20;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12.5px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('주문 음료 내역', rx + 20, cy);
    ctx.textAlign = 'right';
    ctx.fillText(`수량 / 금액 (총 ${totalCount}잔)`, rx + rw - 20, cy);

    cy += 8;

    // 6. 주문 음료 라인 아이템
    orderItems.forEach(item => {
      cy += 24;
      ctx.fillStyle = '#1E293B';
      ctx.font = '600 12px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      const menuTitle = item.menu?.name || '☕ 아이스 아메리카노';
      ctx.fillText(menuTitle, rx + 20, cy);

      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${item.count}잔 / ${(item.subtotal || 0).toLocaleString()}원`, rx + rw - 20, cy);
    });

    cy += 18;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx + 18, cy);
    ctx.lineTo(rx + rw - 18, cy);
    ctx.stroke();

    // 7. 총 결제금액
    cy += 24;
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 15px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('총 예상 결제금액', rx + 20, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#E11D48';
    ctx.font = '900 17px monospace';
    ctx.fillText(`${totalAmount.toLocaleString()}원`, rx + rw - 20, cy);

    if (payerCount > 1) {
      cy += 18;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11.5px Pretendard, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`(결제자 ${payerCount}인 분담 · 1인당 약 ${perPayerAmount.toLocaleString()}원)`, rx + rw - 20, cy);
    }

    cy += 12;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx + 18, cy);
    ctx.lineTo(rx + rw - 18, cy);
    ctx.stroke();

    // 8. 빨간 고무 도장 (결 제 확 정)
    ctx.save();
    ctx.translate(rx + rw - 82, ry + 150);
    ctx.rotate(-0.22);
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.82)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-48, -16, 96, 32);
    ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
    ctx.font = '900 15px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('결 제 확 정', 0, 1);
    ctx.restore();

    // 9. 하단 안내 문구 및 바코드
    cy += 24;
    ctx.fillStyle = '#64748B';
    ctx.font = '10.5px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(footnote.replace(/<[^>]*>/g, ''), width / 2, cy);

    cy += 18;
    const barWidths = [2, 4, 1, 3, 2, 5, 1, 3, 2, 4, 2, 1, 4, 2, 3, 1, 3, 2];
    let bx = width / 2 - 48;
    ctx.fillStyle = '#1E293B';
    barWidths.forEach(w => {
      ctx.fillRect(bx, cy, w, 24);
      bx += w + 3;
    });

    // 10. PNG 다운로드 트리거
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `office-derby-receipt-${seedCode || Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  static drawDashedLine(ctx, x1, x2, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }
}
