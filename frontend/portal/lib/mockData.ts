export type Consult = {
  id: string;
  topic: string;
  hospital: string;
  physician: string;
  patientRef: string;
  priority: 'normal' | 'critical';
  createdAt: string;
  summary: string;
  checklist: string[];
  attachments: number;
  transcript: string[];
};

export const mockConsults: Consult[] = [
  {
    id: 'CONS-27848-01',
    topic: 'Neonatal respiratory distress',
    hospital: 'Kinderklinik Nord',
    physician: 'Dr. Laura Klein',
    patientRef: 'NICU-88442',
    priority: 'critical',
    createdAt: '2026-01-28T08:42:00Z',
    summary:
      'Term neonate with escalating oxygen demand, CXR indicates diffuse reticulogranular pattern. Need review of current ventilation strategy and surfactant plan.',
    checklist: [
      'Gas exchange trend last 12h',
      'Ventilator screenshots',
      'Photographs of recent chest X-ray'
    ],
    attachments: 3,
    transcript: [
      'Sats 86-90% despite 60% FiO2',
      'Pre/post ductal gradient widening',
      'Family en route to tertiary center'
    ]
  },
  {
    id: 'CONS-30122-02',
    topic: 'Pediatric cardiology',
    hospital: 'St. Maria Hospital',
    physician: 'Dr. Miguel Santos',
    patientRef: 'CARD-55410',
    priority: 'normal',
    createdAt: '2026-01-27T17:05:00Z',
    summary:
      '6-year-old with repaired TOF presenting with fatigue. Echo attachments uploaded. Need differential and recommended labs before transfer.',
    checklist: ['Latest ECG', 'Medication list', 'Allergy confirmation'],
    attachments: 2,
    transcript: ['Echo zipped', 'Parents consent for tele-auscultation tomorrow']
  }
];
