import { useState } from 'react';
import { Button, Chip, Field, Input } from '../ui';
import { StationCombobox } from '../StationCombobox';
import { OfferCard } from '../OfferCard';
import { EmptyState } from '../EmptyState';
import { SkeletonCards } from '../Skeleton';
import { SearchIcon } from '../icons';
import { useWays } from '../../hooks/use-ways';
import { isoDate, shiftIso } from '../../lib/format';
import { CLASS_OPTIONS, type Offer, type Station } from '../../types';

export function WaysView({
  onWatchOffer,
}: {
  onWatchOffer: (offer: Offer, from: Station, to: Station) => void;
}) {
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [dateFrom, setDateFrom] = useState(isoDate(7));
  const [days, setDays] = useState(1);
  const [slack, setSlack] = useState(0);
  const [sort, setSort] = useState<'cheapest' | 'balanced'>('cheapest');
  const [classes, setClasses] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState('');
  const ways = useWays();

  const dates = Array.from({ length: days }, (_, index) => shiftIso(dateFrom, index));
  const ready = from != null && to != null && from.id !== to.id;

  const handleSearch = (): void => {
    if (!ready) return;
    void ways.search({
      fromId: from!.id,
      toId: to!.id,
      dates,
      slack,
      sort,
      ...(classes.length > 0 ? { classes } : {}),
      ...(maxPrice ? { maxPriceKop: Math.round(Number(maxPrice) * 100) } : {}),
    });
  };

  const toggleClass = (id: string): void =>
    setClasses((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const cheapestPrice = ways.state?.offers[0]?.priceKop ?? null;

  return (
    <>
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <StationCombobox
          label="Звідки"
          placeholder="Київ-Пасажирський"
          value={from}
          onPick={setFrom}
        />
        <StationCombobox label="Куди" placeholder="Львів" value={to} onPick={setTo} />

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2">
            <Field label="Дата">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Днів">
            <Input
              type="number"
              min={1}
              max={14}
              value={days}
              onChange={(event) => setDays(Math.max(1, Math.min(14, Number(event.target.value))))}
            />
          </Field>
          <Field label="± днів">
            <Input
              type="number"
              min={0}
              max={3}
              value={slack}
              onChange={(event) => setSlack(Math.max(0, Math.min(3, Number(event.target.value))))}
            />
          </Field>
        </div>

        <Field label="Класи вагонів">
          <div className="flex flex-wrap gap-2">
            {CLASS_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                active={classes.includes(option.id)}
                onClick={() => toggleClass(option.id)}
              >
                {option.title}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 items-start gap-2">
          <Field label="Стеля ціни, грн">
            <Input
              type="number"
              min={0}
              placeholder="без обмеження"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </Field>
          <Field label="Порядок">
            <div className="flex flex-wrap gap-2">
              <Chip active={sort === 'cheapest'} onClick={() => setSort('cheapest')}>
                Найдешевше
              </Chip>
              <Chip active={sort === 'balanced'} onClick={() => setSort('balanced')}>
                Ціна й час
              </Chip>
            </div>
          </Field>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!ready || ways.busy}
          onClick={handleSearch}
        >
          {ways.busy ? 'Шукаю…' : 'Знайти спосіб доїхати'}
        </Button>
      </div>

      {ways.error ? <p className="text-xs text-red-600">{ways.error}</p> : null}

      {ways.busy ? <SkeletonCards count={3} /> : null}

      {!ways.busy && ways.state ? (
        <>
          <p className="px-1 text-[11px] text-gray-500">
            перебрано варіантів: {ways.state.candidates} · витрачено запитів: {ways.state.requests}
            {ways.state.gated ? ' · гейт УЗ' : ''}
          </p>
          {ways.state.offers.length === 0 ? (
            <EmptyState
              title="Нічого не знайшлося"
              description="На ці дати місць немає навіть в обхідних варіантах. Створи стеження — сторож повідомить, щойно щось зʼявиться."
              icon={<SearchIcon className="h-6 w-6" />}
            />
          ) : (
            ways.state.offers
              .slice(0, 20)
              .map((offer) => (
                <OfferCard
                  key={`${offer.tripId}-${offer.classId}-${offer.fromId}-${offer.toId}`}
                  offer={offer}
                  cheapest={offer.priceKop === cheapestPrice}
                  onWatch={ready ? (value) => onWatchOffer(value, from!, to!) : undefined}
                />
              ))
          )}
        </>
      ) : null}

      {!ways.busy && !ways.state ? (
        <EmptyState
          title="Куди їдемо?"
          description="Сторож перевіряє не лише прямі рейси: сусідні станції, наскрізні сегменти, пересадки УЗ і сусідні дати."
          icon={<SearchIcon className="h-6 w-6" />}
        />
      ) : null}
    </>
  );
}
