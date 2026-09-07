import TaxCalendarTable from "./components/TaxCalendarTable"

export default function TaxCalendarPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium text-gray-900">Tax Deadline Calendar</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            US and Canadian tax deadlines — updated every Sunday
          </p>
        </div>
      </div>
      <TaxCalendarTable />
    </div>
  )
}