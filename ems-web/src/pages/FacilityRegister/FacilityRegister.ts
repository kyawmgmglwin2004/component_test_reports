
export type ListItem = {
  code: string;
  label: string;
};

export type facilityType = '0' | '1';
export type FacilityImage = {
  relativePath: string;
  displayName: string;
  presignedUrl: string;
};

export type RegisterFormData = {
  facilityType: string;
  facilityID: string;
  ecoCompanyID: string;
  ecoCompanyPassword: string;
  facilityName: string;
  facilityAddress: string;
  cityInfo: string;

  facilityImage: FacilityImage | null;

  facilityImageUrl: string;
  imageFilename: string;

  facilityStatus: string;
  facilityManagerName: string;
  facilityManagerMail: string;
};