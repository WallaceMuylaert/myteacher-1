export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national_holiday' | 'optional_holiday' | 'educational';
  description?: string;
}

/**
 * Calcula a data da Páscoa para um determinado ano utilizando o algoritmo de Meeus/Jones/Butcher.
 */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retorna todos os feriados nacionais, pontos facultativos e datas escolares relevantes para o ano.
 */
export function getBrazilianHolidays(year: number): Holiday[] {
  const easter = getEasterDate(year);

  const carnavalSeg = addDays(easter, -48);
  const carnavalTer = addDays(easter, -47);
  const quartaCinzas = addDays(easter, -46);
  const sextaSanta = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const holidays: Holiday[] = [
    // Feriados Nacionais Fixos
    { date: `${year}-01-01`, name: 'Confraternização Universal (Ano Novo)', type: 'national_holiday' },
    { date: `${year}-04-21`, name: 'Tiradentes', type: 'national_holiday' },
    { date: `${year}-05-01`, name: 'Dia do Trabalhador', type: 'national_holiday' },
    { date: `${year}-09-07`, name: 'Independência do Brasil', type: 'national_holiday' },
    { date: `${year}-10-12`, name: 'Nossa Senhora Aparecida', type: 'national_holiday' },
    { date: `${year}-11-02`, name: 'Finados', type: 'national_holiday' },
    { date: `${year}-11-15`, name: 'Proclamação da República', type: 'national_holiday' },
    { date: `${year}-11-20`, name: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'national_holiday' },
    { date: `${year}-12-25`, name: 'Natal', type: 'national_holiday' },

    // Feriados Móveis
    { date: formatDate(sextaSanta), name: 'Sexta-feira Santa (Paixão de Cristo)', type: 'national_holiday' },
    { date: formatDate(easter), name: 'Páscoa', type: 'national_holiday' },

    // Pontos Facultativos e Datas Educacionais
    { date: formatDate(carnavalSeg), name: 'Carnaval (Segunda-feira)', type: 'optional_holiday' },
    { date: formatDate(carnavalTer), name: 'Carnaval (Terça-feira)', type: 'optional_holiday' },
    { date: formatDate(quartaCinzas), name: 'Quarta-feira de Cinzas', type: 'optional_holiday', description: 'Ponto facultativo até 14h' },
    { date: formatDate(corpusChristi), name: 'Corpus Christi', type: 'optional_holiday' },
    { date: `${year}-10-15`, name: 'Dia do Professor', type: 'educational', description: 'Data comemorativa especial para a educação' },
    { date: `${year}-10-28`, name: 'Dia do Servidor Público', type: 'optional_holiday' },
    { date: `${year}-12-24`, name: 'Véspera de Natal', type: 'optional_holiday', description: 'Ponto facultativo após 14h' },
    { date: `${year}-12-31`, name: 'Véspera de Ano Novo', type: 'optional_holiday', description: 'Ponto facultativo após 14h' },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}
