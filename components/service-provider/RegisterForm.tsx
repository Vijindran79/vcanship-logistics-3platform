// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../supabase";

import { serviceProviderSchema } from "../../lib/validations/serviceProvider";
import { showToast, toggleLoading } from "../../ui";

const services = [
  { id: "parcel", label: "Parcel" },
  { id: "air_freight", label: "Air Freight" },
  { id: "baggage", label: "Baggage" },
  { id: "fcl", label: "FCL" },
  { id: "lcl", label: "LCL" },
  { id: "vehicle_shipping", label: "Vehicle Shipping" },
  { id: "railway_freight", label: "Railway Freight" },
  { id: "bulk_charter", label: "Bulk Charter" },
  { id: "river_barge_tug", label: "River Barge / Tug" },
  { id: "warehousing", label: "Warehousing" },
  { id: "schedule_trade_lanes", label: "Schedule Trade Lanes" },
  { id: "trade_finance", label: "Trade Finance" },
];

const regions = [
  { id: "africa", label: "Africa" },
  { id: "asia", label: "Asia" },
  { id: "europe", label: "Europe" },
  { id: "north_america", label: "North America" },
  { id: "south_america", label: "South America" },
  { id: "oceania", label: "Oceania" },
  { id: "middle_east", label: "Middle East" },
  { id: "global", label: "Global" },
];

export function RegisterForm() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<z.infer<typeof serviceProviderSchema>>({
    resolver: zodResolver(serviceProviderSchema),
    defaultValues: {
      company_name: "",
      website: "",
      email: "",
      phone: "",
      address_street: "",
      address_city: "",
      address_country: "",
      services: [],
      coverage_regions: [],
    },
  });

  const watchServices = watch("services", []);
  const watchRegions = watch("coverage_regions", []);

  async function onSubmit(values: z.infer<typeof serviceProviderSchema>) {
    toggleLoading(true, "Submitting registration...");
    
    let logoUrl: string | null = null;
    let documentUrl: string | null = null;

    try {
      if (values.logo && values.logo.length > 0) {
        const file = values.logo[0];
        const filePath = `public/${uuidv4()}-${file.name}`;
        const { error } = await supabase.storage.from("provider-logos").upload(filePath, file);
        if (error) throw new Error(`Logo upload failed: ${error.message}`);
        const { data } = supabase.storage.from("provider-logos").getPublicUrl(filePath);
        logoUrl = data.publicUrl;
      }

      if (values.business_document && values.business_document.length > 0) {
        const docFile = values.business_document[0];
        const docFilePath = `public/${uuidv4()}-${docFile.name}`;
        const { error } = await supabase.storage.from("provider-documents").upload(docFilePath, docFile);
        if (error) throw new Error(`Document upload failed: ${error.message}`);
        const { data } = supabase.storage.from("provider-documents").getPublicUrl(docFilePath);
        documentUrl = data.publicUrl;
      }

      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .insert({
          company_name: values.company_name,
          website: values.website,
          address_street: values.address_street,
          address_city: values.address_city,
          address_country: values.address_country,
          services_offered: values.services,
          coverage_regions: values.coverage_regions,
          logo_url: logoUrl,
          business_document_url: documentUrl,
          is_public: false,
          is_verified: false,
        })
        .select()
        .single();

      if (providerError) throw new Error(`Database error (provider): ${providerError.message}`);
      if (!providerData) throw new Error("Failed to create service provider record.");

      const { error: contactError } = await supabase
        .from("service_provider_contacts")
        .insert({
          provider_id: providerData.id,
          email: values.email,
          phone: values.phone,
          is_primary: true,
        });
      
      if (contactError) throw new Error(`Database error (contact): ${contactError.message}`);

      showToast("Registration Submitted!", "success");
      reset();
      setLogoPreview(null);
      setDocumentFileName(null);
    } catch (error) {
      console.error("Submission error:", error);
      showToast(error instanceof Error ? error.message : "An unexpected error occurred.", "error");
    } finally {
      toggleLoading(false);
    }
  }

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <div className="form-section two-column">
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Company Information</h3>
            <div className="input-wrapper">
              <label htmlFor="company_name">Company Name</label>
              <input id="company_name" {...register("company_name")} placeholder="Global Logistics Inc." />
              {errors.company_name && <p className="error-text">{errors.company_name.message}</p>}
            </div>
            <div className="input-wrapper">
              <label htmlFor="website">Website</label>
              <input id="website" {...register("website")} placeholder="https://globallogistics.com" />
              {errors.website && <p className="error-text">{errors.website.message}</p>}
            </div>
            <div className="input-wrapper">
              <label htmlFor="logo">Company Logo</label>
              <input
                id="logo"
                type="file"
                accept="image/png, image/jpeg"
                {...register("logo", {
                  onChange: (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setLogoPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setLogoPreview(null);
                    }
                  }
                })}
              />
              <p className="helper-text">PNG or JPG, max 2MB.</p>
              {logoPreview && <img src={logoPreview} alt="Logo preview" style={{ width: 100, height: 100, objectFit: 'contain', marginTop: '1rem', borderRadius: 'var(--border-radius)' }} />}
              {errors.logo && <p className="error-text">{errors.logo.message as string}</p>}
            </div>
            <div className="input-wrapper">
              <label htmlFor="business_document">Business Registration Document</label>
              <input
                id="business_document"
                type="file"
                accept=".pdf,.docx"
                 {...register("business_document", {
                  onChange: (e) => {
                    const file = e.target.files?.[0];
                    setDocumentFileName(file ? file.name : null);
                  }
                })}
              />
              <p className="helper-text">PDF or DOCX, max 5MB.</p>
              {documentFileName && <p className="helper-text" style={{marginTop: '0.5rem'}}>Selected: {documentFileName}</p>}
              {errors.business_document && <p className="error-text">{errors.business_document.message as string}</p>}
            </div>
          </div>
          
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Contact & Address</h3>
            <div className="input-wrapper">
              <label htmlFor="email">Primary Contact Email</label>
              <input id="email" type="email" {...register("email")} placeholder="contact@company.com" />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <div className="input-wrapper">
              <label htmlFor="phone">Primary Contact Phone</label>
              <input id="phone" {...register("phone")} placeholder="+1 (555) 123-4567" />
              {errors.phone && <p className="error-text">{errors.phone.message}</p>}
            </div>
            <div className="input-wrapper">
              <label htmlFor="address_street">Street Address</label>
              <input id="address_street" {...register("address_street")} placeholder="123 Logistics Lane" />
              {errors.address_street && <p className="error-text">{errors.address_street.message}</p>}
            </div>
            <div className="form-section two-column" style={{gap: '1rem'}}>
              <div className="input-wrapper">
                <label htmlFor="address_city">City</label>
                <input id="address_city" {...register("address_city")} placeholder="New York" />
                {errors.address_city && <p className="error-text">{errors.address_city.message}</p>}
              </div>
              <div className="input-wrapper">
                <label htmlFor="address_country">Country</label>
                <input id="address_country" {...register("address_country")} placeholder="USA" />
                {errors.address_country && <p className="error-text">{errors.address_country.message}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <label className="text-lg font-medium">Services Offered</label>
          <p className="helper-text">Select all the services your company provides.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'}}>
            {services.map((item) => (
              <div key={item.id} className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id={`service-${item.id}`}
                  value={item.id}
                  {...register("services")}
                />
                <label htmlFor={`service-${item.id}`}>{item.label}</label>
              </div>
            ))}
          </div>
          {errors.services && <p className="error-text">{errors.services.message}</p>}
        </div>

        <div className="form-section">
          <label className="text-lg font-medium">Coverage Regions</label>
          <p className="helper-text">Select all regions your company operates in.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'}}>
            {regions.map((item) => (
              <div key={item.id} className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id={`region-${item.id}`}
                  value={item.id}
                  {...register("coverage_regions")}
                />
                <label htmlFor={`region-${item.id}`}>{item.label}</label>
              </div>
            ))}
          </div>
          {errors.coverage_regions && <p className="error-text">{errors.coverage_regions.message}</p>}
        </div>

        <div className="form-actions">
          <button type="submit" className="main-submit-btn">
            Submit Registration
          </button>
        </div>
      </form>
    </div>
  );
}