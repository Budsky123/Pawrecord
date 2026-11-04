export type AppRole = 'vet' | 'staff' | 'owner';

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  phone: string | null;
};

export type Pet = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  sex: 'female' | 'male' | 'unknown';
  photo_url: string | null;
  health_status: 'healthy' | 'follow_up' | 'medication';
  owners?: { full_name: string; email: string };
};

export type Appointment = {
  id: string;
  pet_id: string;
  vet_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  pets: Pick<Pet, 'name' | 'photo_url'> & { owners?: { full_name: string } };
  profiles?: { full_name: string };
};

export type VaccineDue = {
  vaccination_id: string;
  pet_id: string;
  pet_name: string;
  vaccine_name: string;
  next_due_on: string;
  days_until_due: number;
  status: 'overdue' | 'due_soon';
};

export type Visit = {
  id: string;
  visit_date: string;
  reason: string;
  category: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  pets?: Pick<Pet, 'name' | 'photo_url'>;
  profiles?: { full_name: string };
};

export type Vaccination = {
  id: string;
  pet_id: string;
  vaccine_type_id: string;
  given_on: string;
  next_due_on: string;
  pets?: Pick<Pet, 'name' | 'photo_url'>;
  vaccine_types?: { name: string };
};
