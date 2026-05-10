import { Shield } from "lucide-react";
import { ProfileFormSubComponentProps } from "./types";

export function PrivateLogisticsSection({ form, inputClass, labelClass, sectionClass }: ProfileFormSubComponentProps) {
  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-2 mb-2 text-sm font-black uppercase tracking-wider text-ares-red">
        <Shield size={16} /> Team Logistics (Private)
      </div>
      <p className="text-xs text-ares-gray mb-4">
        This information is strictly for event organization and travel. It will NEVER be shown publicly.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label htmlFor="pe-tshirt" className={labelClass}>T-Shirt Size</label>
          <form.Field name="tshirtSize">
            {(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              field: any
            ) => (
              <select
                id="pe-tshirt"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Select Size...</option>
                <option value="Youth Medium">Youth Medium</option>
                <option value="Youth Large">Youth Large</option>
                <option value="Adult Small">Adult Small</option>
                <option value="Adult Medium">Adult Medium</option>
                <option value="Adult Large">Adult Large</option>
                <option value="Adult XL">Adult XL</option>
                <option value="Adult 2XL">Adult 2XL</option>
                <option value="Adult 3XL">Adult 3XL</option>
              </select>
            )}
          </form.Field>
        </div>
        <div className="md:col-span-1">
          <label htmlFor="pe-ec-name" className={labelClass}>Emergency Contact Name</label>
          <form.Field name="emergencyContactName">
            {(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              field: any
            ) => (
              <input
                id="pe-ec-name"
                name={field.name}
                className={inputClass}
                placeholder="Parent/Guardian Name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </div>
        <div className="md:col-span-1">
          <label htmlFor="pe-ec-phone" className={labelClass}>Emergency Contact Phone</label>
          <form.Field name="emergencyContactPhone">
            {(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              field: any
            ) => (
              <input
                id="pe-ec-phone"
                name={field.name}
                className={inputClass}
                placeholder="(304) 555-1234"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </div>
      </div>
    </div>
  );
}
