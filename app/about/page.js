// app/about/page.js -- About us. Facts only: what BlindSpot does, where
// the data comes from, who runs it.

import Link from 'next/link';
import LegalPage, { COMPANY } from '@/components/LegalPage';

export const metadata = {
  title: 'About us',
  description: 'BlindSpot shows what a property listing leaves out: real sunlight for your floor, and what records say about the neighbourhood.',
  alternates: { canonical: '/about' },
};

const sections = [
  {
    id: 'what',
    title: 'What we do',
    body: (
      <>
        <p>
          BlindSpot shows what a property listing leaves out. Search a flat, tap its tower on a 3D
          map, set the floor and facing, and you get two scores: one for the neighbourhood and one
          for the flat itself.
        </p>
        <ul>
          <li><strong>The flat:</strong> how much direct sun it gets through the year, heat, view, privacy, ventilation, dampness and noise, worked out from the sun&apos;s real path and the buildings around it.</li>
          <li><strong>The neighbourhood:</strong> safety, schools, air, water, power, roads, infrastructure and drainage for the pincode, from public records.</li>
          <li><strong>The visit:</strong> a list of what to check and ask before you decide.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'why',
    title: 'Why',
    body: (
      <p>
        Most people choose a home after one short visit, often at one time of day, guided by
        someone who earns when they buy. BlindSpot scores every flat the same way. We don&apos;t
        earn from sellers, builders or brokers.
      </p>
    ),
  },
  {
    id: 'data',
    title: 'Where the data comes from',
    body: (
      <p>
        Sun and shadow come from solar geometry and building heights from OpenStreetMap and OSM
        Buildings. Neighbourhood scores come from government and civic sources such as police
        crime records, CPCB air readings, electricity and water board reports and the CBSE school
        list. Much of it is estimated at pincode or zone level; the detailed area report shows
        the source and date for each figure.
      </p>
    ),
  },
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          BlindSpot is run by {COMPANY}, founded by Arushri Gangji and Gurshaan Singh Baweja.
          Neighbourhood scores cover Delhi NCR, Bangalore, Chandigarh, Hyderabad, Mumbai, Chennai,
          Ahmedabad and Kolkata; the flat score works anywhere.
        </p>
        <p>
          Scores, the 3D sun map and the visit checklist are free. Detailed written reports cost
          Keys: see <Link href="/pricing">Pricing</Link>. Questions: <Link href="/contact">Contact us</Link>.
        </p>
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <LegalPage
      title="About BlindSpot"
      intro="Every property has a blindspot. We help you find it before you sign."
      sections={sections}
      current="/about"
      updated={false}
    />
  );
}
