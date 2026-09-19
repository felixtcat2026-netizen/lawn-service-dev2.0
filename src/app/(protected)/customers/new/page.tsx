import { CustomerForm } from "@/components/CustomerForm";
import { createCustomer } from "@/lib/actions/customers";

export default function NewCustomerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Add Customer</h1>
      <CustomerForm action={createCustomer} submitLabel="Add Customer" />
    </div>
  );
}
