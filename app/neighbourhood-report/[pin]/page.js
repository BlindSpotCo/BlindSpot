import { notFound } from 'next/navigation';
import { getReportData } from '@/lib/neighbourhood-report/getReportData';
import NeighbourhoodReport from '@/components/neighbourhood-report/NeighbourhoodReport';

export async function generateMetadata({ params, searchParams }) {
  const { pin } = await params;
  const { sector } = await searchParams;
  const data = getReportData(pin, 4, sector);
  if (!data) return { title: 'Neighbourhood Report — BlindSpot' };
  const { record } = data;
  return {
    title: `${record.name} Neighbourhood Report — ${record.nqi_composite}/100 (${record.grade}) | BlindSpot`,
    description: `Full neighbourhood report for ${record.name} (${record.pin_code}): crime, air quality, infrastructure, power, water, schools and price context.`,
  };
}

export default async function NeighbourhoodReportPage({ params, searchParams }) {
  const { pin } = await params;
  const { sector } = await searchParams;
  const data = getReportData(pin, 4, sector);
  if (!data) notFound();

  return <NeighbourhoodReport record={data.record} nearby={data.nearby} />;
}
