import axios from 'axios';

export interface AptTransaction {
  aptNm: string;
  dealAmount: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  excluArea: number;
  floor: number;
  jibun: string;
  pricePerPyeong: number;
}

export const fetchAptTransactions = async (lawdCd: string, dealYmd: string): Promise<string> => {
  try {
    const response = await axios.get(`/api/apt-transactions?lawdCd=${lawdCd}&dealYmd=${dealYmd}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching APT transactions:', error);
    throw error;
  }
};

export const parseAptTransactions = (xmlText: string): AptTransaction[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.getElementsByTagName('item');
  const transactions: AptTransaction[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aptNm = item.getElementsByTagName('aptNm')[0]?.textContent || '';
    const dealAmountStr = item.getElementsByTagName('dealAmount')[0]?.textContent || '0';
    const dealYear = parseInt(item.getElementsByTagName('dealYear')[0]?.textContent || '0');
    const dealMonth = parseInt(item.getElementsByTagName('dealMonth')[0]?.textContent || '0');
    const dealDay = parseInt(item.getElementsByTagName('dealDay')[0]?.textContent || '0');
    const excluArea = parseFloat(item.getElementsByTagName('excluArea')[0]?.textContent || '0');
    const floor = parseInt(item.getElementsByTagName('floor')[0]?.textContent || '0');
    const jibun = item.getElementsByTagName('jibun')[0]?.textContent || '';

    const dealAmount = parseInt(dealAmountStr.replace(/,/g, ''));
    const pricePerPyeong = excluArea > 0 ? Math.round((dealAmount / excluArea) * 3.305785) : 0;

    transactions.push({
      aptNm,
      dealAmount,
      dealYear,
      dealMonth,
      dealDay,
      excluArea,
      floor,
      jibun,
      pricePerPyeong,
    });
  }

  return transactions;
};

export const getRecentMonths = (count: number): string[] => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${year}${month}`);
  }
  return months;
};

export const getRecentAptTransactions = async (lawdCd: string, monthsCount: number = 3): Promise<AptTransaction[]> => {
  const months = getRecentMonths(monthsCount);
  const promises = months.map(month => fetchAptTransactions(lawdCd, month));
  
  try {
    const xmlResults = await Promise.all(promises);
    const allTransactions = xmlResults.flatMap(xml => parseAptTransactions(xml));
    return allTransactions.sort((a, b) => {
      if (a.dealYear !== b.dealYear) return b.dealYear - a.dealYear;
      if (a.dealMonth !== b.dealMonth) return b.dealMonth - a.dealMonth;
      return b.dealDay - a.dealDay;
    });
  } catch (error) {
    console.error('Error fetching recent APT transactions:', error);
    return [];
  }
};
