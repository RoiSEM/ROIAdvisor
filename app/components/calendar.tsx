"use client";

import { useEffect, useMemo, useState } from "react";

type ReportDatePickerProps = {
  isPro: boolean;
  value?: {
    startDate: string;
    endDate: string;
  };
  onChange?: (range: { startDate: string; endDate: string }) => void;
  onUpgradeClick?: () => void;
};

function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function getTrialDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    startDate: formatDateForInput(start),
    endDate: formatDateForInput(end),
  };
}

export function ReportDatePicker({
  isPro,
  value,
  onChange,
  onUpgradeClick,
}: ReportDatePickerProps) {
  const trialRange = useMemo(() => getTrialDateRange(), []);

  const [startDate, setStartDate] = useState(
    value?.startDate ?? trialRange.startDate,
  );
  const [endDate, setEndDate] = useState(value?.endDate ?? trialRange.endDate);

  useEffect(() => {
    if (value?.startDate) {
      setStartDate(value.startDate);
    }
  }, [value?.startDate]);

  useEffect(() => {
    if (value?.endDate) {
      setEndDate(value.endDate);
    }
  }, [value?.endDate]);

  useEffect(() => {
    if (!isPro) {
      setStartDate(trialRange.startDate);
      setEndDate(trialRange.endDate);
      onChange?.(trialRange);
    }
  }, [isPro, onChange, trialRange]);

  function handleStartDateChange(nextStartDate: string) {
    setStartDate(nextStartDate);
    onChange?.({
      startDate: nextStartDate,
      endDate,
    });
  }

  function handleEndDateChange(nextEndDate: string) {
    setEndDate(nextEndDate);
    onChange?.({
      startDate,
      endDate: nextEndDate,
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Report date range</p>
        <p className="text-sm text-gray-600">
          {isPro
            ? "Choose any custom date range for your report."
            : "Trial accounts are limited to the last 30 days."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="startDate"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            disabled={!isPro}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            End date
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            disabled={!isPro}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
      </div>

      {!isPro && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Upgrade to Pro to unlock custom date ranges, historical reporting,
            and advanced filtering.
          </p>
          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="mt-3 inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      )}
    </div>
  );
}
