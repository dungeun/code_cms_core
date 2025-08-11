/**
 * 한국형 날짜 선택 컴포넌트
 * shadcn/ui DatePicker를 한국 형식으로 확장
 */

import * as React from 'react';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export interface KrDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showTime?: boolean;
  format?: string;
}

export function KrDatePicker({
  value,
  onChange,
  placeholder = '날짜를 선택하세요',
  className,
  disabled = false,
  showTime = false,
  format: dateFormat,
}: KrDatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [hour, setHour] = React.useState<string>('00');
  const [minute, setMinute] = React.useState<string>('00');

  React.useEffect(() => {
    if (value) {
      setDate(value);
      setHour(String(value.getHours()).padStart(2, '0'));
      setMinute(String(value.getMinutes()).padStart(2, '0'));
    }
  }, [value]);

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate && showTime) {
      newDate.setHours(parseInt(hour));
      newDate.setMinutes(parseInt(minute));
    }
    setDate(newDate);
    onChange?.(newDate);
  };

  const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
    if (type === 'hour') {
      setHour(value);
      if (date) {
        const newDate = new Date(date);
        newDate.setHours(parseInt(value));
        setDate(newDate);
        onChange?.(newDate);
      }
    } else {
      setMinute(value);
      if (date) {
        const newDate = new Date(date);
        newDate.setMinutes(parseInt(value));
        setDate(newDate);
        onChange?.(newDate);
      }
    }
  };

  const formatString = dateFormat || (showTime ? 'yyyy년 MM월 dd일 HH:mm' : 'yyyy년 MM월 dd일');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, formatString, { locale: ko }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateChange}
          initialFocus
          locale={ko}
        />
        {showTime && (
          <div className="flex items-center gap-2 border-t p-3">
            <Select value={hour} onValueChange={(value) => handleTimeChange('hour', value)}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i).padStart(2, '0')}>
                    {String(i).padStart(2, '0')}시
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={minute} onValueChange={(value) => handleTimeChange('minute', value)}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 60 }, (_, i) => (
                  <SelectItem key={i} value={String(i).padStart(2, '0')}>
                    {String(i).padStart(2, '0')}분
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * 한국형 날짜 범위 선택 컴포넌트
 */
export interface KrDateRangePickerProps {
  from?: Date;
  to?: Date;
  onChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function KrDateRangePicker({
  from,
  to,
  onChange,
  placeholder = '기간을 선택하세요',
  className,
  disabled = false,
}: KrDateRangePickerProps) {
  const [date, setDate] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from,
    to,
  });

  React.useEffect(() => {
    setDate({ from, to });
  }, [from, to]);

  const handleDateChange = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (range) {
      setDate(range);
      onChange?.(range);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !date.from && !date.to && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date.from ? (
            date.to ? (
              <>
                {format(date.from, 'yyyy년 MM월 dd일', { locale: ko })} -{' '}
                {format(date.to, 'yyyy년 MM월 dd일', { locale: ko })}
              </>
            ) : (
              format(date.from, 'yyyy년 MM월 dd일', { locale: ko })
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={date as any}
          onSelect={handleDateChange as any}
          numberOfMonths={2}
          initialFocus
          locale={ko}
        />
      </PopoverContent>
    </Popover>
  );
}