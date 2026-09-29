/**
 * One printed bingo card (docs/games-bingo-PRD.md §3.4). Presentational only:
 * which squares, in which order, is decided in lib/bingo.ts.
 *
 * Text is rendered by React, so it is escaped — the original page built this
 * as an HTML string, which put whatever was typed in the editor straight into
 * the DOM as markup.
 */

import Image from 'next/image'
import type { BingoLanguage } from '@/lib/bingo'
import type { BingoSquare } from '@/lib/types'
import { strings } from '@/lib/strings'
import styles from './bingo-card.module.css'

/** Index 12 of 25: the centre of a 5×5 grid. */
const FREE_INDEX = 12

export function BingoCard({
  language,
  squares,
}: {
  language: BingoLanguage
  squares: BingoSquare[]
}) {
  const text = strings.bingo.card[language]
  const cells = [...squares.slice(0, FREE_INDEX), null, ...squares.slice(FREE_INDEX)]

  return (
    <div className={styles.page}>
      <div
        className={language === 'ru' ? `${styles.card} ${styles.ru}` : styles.card}
        lang={language}
        dir={language === 'ru' ? 'ltr' : 'rtl'}
      >
        <div className={styles.head}>
          <div className={styles.names}>{strings.bingo.card.names}</div>
          <div className={styles.dots} aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.label}>{text.label}</div>
          <div className={styles.meta}>{text.meta}</div>
        </div>

        <div className={styles.grid}>
          {cells.map((square, index) =>
            square === null ? (
              <div key="free" className={`${styles.cell} ${styles.free}`}>
                <span className={styles.freeLabel}>{strings.bingo.card.free}</span>
                <span className={styles.freeRule} />
              </div>
            ) : (
              // Index, not id: a square can repeat on one card when the list is short.
              <div key={index} className={styles.cell}>
                {language === 'he' ? square.text_he : square.text_ru}
              </div>
            )
          )}
        </div>

        <div className={styles.photo}>
          {/* 260px source shown at 130px: sharp on paper and on retina screens.
              Eager, not lazy: the print dialog renders cards that were never
              scrolled into view, and a lazy image there prints as a blank.
              It is one cached file, so eager costs a single request. */}
          <Image
            src="/assets/games/bingo-couple.jpg"
            alt=""
            width={130}
            height={173}
            loading="eager"
          />
        </div>

        <div className={styles.foot}>
          <span className={`${styles.dot} ${styles.pink}`} />
          <span>{text.footer}</span>
          <span className={`${styles.dot} ${styles.blue}`} />
        </div>
      </div>
    </div>
  )
}
