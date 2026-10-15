# Analitika (Google Analytics 4)

GA se učitava **samo nakon privole** („Prihvaćam” na traci). Odbijanje ili kasnije povlačenje privole („Postavke kolačića” u podnožju) briše `_ga` kolačiće i zaustavlja slanje.
Google signals i ad_* signali su uvijek isključeni.

**Nikad se ne šalje:** datum rođenja, ime djeteta, tekst e-maila. Dob djeteta šalje se samo kao skupina (`child_age_group`).

Measurement ID: `.env` → `VITE_GA_ID`. Prazno = analitika isključena.

## Događaji

| Događaj | Kada | Parametri |
|---|---|---|
| `page_view` | automatski (GA) | – |
| `filter_type` | odabir Sva / Obvezna / Dodatna | `vaccine_type` |
| `filter_age` | odabir dobi (vremenska crta ili gumb u zaglavlju) | `age_group`, `source` (`timeline` / `hero`) |
| `search` | pretraga (nakon 1,2 s bez tipkanja) ili klik na prijedlog | `search_term`, `source`, `result_count` |
| `search_no_results` | pretraga bez rezultata | `search_term` |
| `reset_filters` | „Poništi filtre” | – |
| `vaccine_details_open` | otvaranje „Detalji i raspored” na kartici | `vaccine_id`, `vaccine_category` |
| `faq_open` | otvaranje pitanja | `faq_id` |
| `schedule_created` | izračunat osobni kalendar (po datumu + obuhvatu) | `schedule_scope`, `child_age_group`, `upcoming_count`, `has_child_name` |
| `schedule_scope_change` | „Samo obavezna” / „Obvezna + preporučena” | `schedule_scope` |
| `vaccine_interest_toggle` | označavanje cjepiva za upit pedijatru | `vaccine_id`, `checked` |
| `calendar_export` ★ | preuzimanje .ics ili „Google kalendar” | `method` (`ics` / `google`), `event_count` |
| `print_schedule` | „Ispiši / PDF” | `event_count` |
| `email_to_pediatrician` ★ | kopiranje ili otvaranje e-maila za pedijatra | `method` (`copy` / `mailto`), `vaccine_count` |

★ = ključni događaj (key event) u GA.

Vanjski linkovi (npr. HZJZ) bilježe se automatski kroz GA *Enhanced measurement* (`click`).

## Prilagođene dimenzije (GA → Admin → Custom definitions)

Event-scoped: `vaccine_type`, `age_group`, `source`, `vaccine_id`, `vaccine_category`, `faq_id`, `schedule_scope`, `child_age_group`, `method`, `checked`, `has_child_name`.
Custom metrics: `result_count`, `upcoming_count`, `event_count`, `vaccine_count`.
`search_term` je ugrađena GA dimenzija.
