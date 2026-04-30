import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, RefreshCw, GitCompare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Badge, ScoreRing, SectionTitle } from '../components/ui';
import {
  calcBrewScore, scoreColor, scoreLabel, formatDate, daysOffRoast,
  brewRatio, bloomRatio, espressoRatio, fToC, calcEY,
} from '../utils';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

export default function BrewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, deleteBrew, getCoffee } = useApp();

  const brew = data.brews.find((b) => b.id === id);
  if (!brew) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/brews')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <p className="text-brew-muted mt-4">Brew not found.</p>
      </div>
    );
  }

  const coffee = getCoffee(brew.coffeeId);
  const score = brew.isQuickLog && brew.quickScore != null ? null : calcBrewScore(brew.flavorProfile);
  const days = coffee?.roastDate ? daysOffRoast(coffee.roastDate, brew.brewDate) : null;

  const radarData = [
    { attr: 'Acidity', value: brew.flavorProfile.acidity },
    { attr: 'Sweetness', value: brew.flavorProfile.sweetness },
    { attr: 'Body', value: brew.flavorProfile.body },
    { attr: 'Florality', value: brew.flavorProfile.florality },
    { attr: 'Clarity', value: brew.flavorProfile.clarity },
    { attr: 'Juiciness', value: brew.flavorProfile.juiciness },
    { attr: 'Finish', value: brew.flavorProfile.finish },
    { attr: 'Astringency', value: brew.flavorProfile.astringency },
    { attr: 'Sourness', value: brew.flavorProfile.sourness },
  ];

  function handleDelete() {
    if (confirm('Delete this brew? This cannot be undone.')) {
      deleteBrew(id!);
      navigate('/brews');
    }
  }

  const moreOf = [
    brew.flavorProfile.moreAcidity && 'Acidity',
    brew.flavorProfile.moreSweetness && 'Sweetness',
    brew.flavorProfile.moreClarity && 'Clarity',
    brew.flavorProfile.moreFlorality && 'Florality',
    brew.flavorProfile.moreBody && 'Body',
  ].filter(Boolean) as string[];

  const lessOf = [
    brew.flavorProfile.lessBitterness && 'Bitterness',
    brew.flavorProfile.lessAstringency && 'Astringency',
    brew.flavorProfile.lessSourness && 'Sourness',
    brew.flavorProfile.lessMuddled && 'Muddled Flavors',
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/brews')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/compare?a=${brew.id}`)}>
            <GitCompare size={14} /> Compare
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/brews/new?fromBrewId=${brew.id}`)}>
            <RefreshCw size={14} /> Brew Again
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/brews/${brew.id}/edit`)}>
            <Edit2 size={14} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="flex items-start gap-6">
        {score !== null ? <ScoreRing score={score} size={80} /> : brew.quickScore != null ? (
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="text-2xl">{'★'.repeat(brew.quickScore)}{'☆'.repeat(5 - brew.quickScore)}</div>
            <span className="text-xs text-brew-faint">Quick score</span>
          </div>
        ) : null}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="amber">{brew.brewMethod}</Badge>
            {brew.isGoToRecipe && <Badge variant="gold">★ Go-To Recipe</Badge>}
            <Badge
              variant={
                brew.flavorProfile.perceivedExtraction === 'Balanced'
                  ? 'positive'
                  : brew.flavorProfile.perceivedExtraction === 'Over'
                  ? 'negative'
                  : brew.flavorProfile.perceivedExtraction === 'Unsure'
                  ? 'default'
                  : 'amber'
              }
            >
              {brew.flavorProfile.perceivedExtraction} Extraction
            </Badge>
          </div>
          <h1 className="font-display italic text-brew-text text-3xl leading-tight">
            {coffee?.roaster ?? 'Unknown'} — {coffee?.countryOrigin ?? ''}
          </h1>
          {coffee && (
            <p className="text-brew-muted text-sm mt-1">
              {coffee.region && `${coffee.region} · `}{coffee.processingMethod} · {coffee.roastLevel}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-brew-faint">{formatDate(brew.brewDate)}</span>
            {days !== null && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days >= 7 && days <= 30 ? 'bg-brew-positive/20 text-brew-positive' : 'bg-brew-border text-brew-muted'}`}>
                {days} days off roast
              </span>
            )}
          </div>
          <div className="mt-1 text-sm flex items-center gap-3 flex-wrap">
            {score !== null && <span style={{ color: scoreColor(score) }}>{scoreLabel(score)} · {score.toFixed(1)}/10</span>}
            {brew.extractionYield != null && (() => {
              const ey = brew.extractionYield;
              const color = ey >= 18 && ey <= 22 ? '#2d6e4e' : ey < 18 ? '#b87d28' : '#9b3328';
              const label = ey >= 18 && ey <= 22 ? 'ideal' : ey < 18 ? 'under' : 'over';
              return (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
                  EY {ey}% · {label}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Brew params */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <SectionTitle>Brew Setup</SectionTitle>
            <dl className="flex flex-col gap-2">
              {[
                { label: 'Device', value: brew.brewingDevice || '—' },
                { label: 'Grinder', value: brew.grinder || '—' },
                { label: 'Grind Setting', value: brew.grindSetting || '—' },
                { label: 'Grind Size', value: brew.grindSize || '—' },
                { label: 'Coffee Dose', value: `${brew.coffeeDose}g` },
                { label: 'Water', value: `${brew.waterAmount}g` },
                { label: 'Brew Ratio', value: brewRatio(brew.waterAmount, brew.coffeeDose) },
                { label: 'Water Temp', value: brew.waterTempF ? `${brew.waterTempF}°F / ${fToC(brew.waterTempF)}°C` : '—' },
                { label: 'Water PPM', value: brew.waterPPM ? `${brew.waterPPM} ppm` : '—' },
                { label: 'Water Recipe', value: brew.waterRecipe || '—' },
                ...(brew.apaxDropsUsed && brew.apaxDrops
                  ? Object.entries(brew.apaxDrops)
                      .filter(([, v]) => v != null)
                      .map(([k, v]) => ({ label: `Apax ${k.charAt(0).toUpperCase() + k.slice(1)}`, value: `${v} drops` }))
                  : []),
                ...(brew.finalBrewWeight != null ? [{ label: 'Final Brew Weight', value: `${brew.finalBrewWeight}g` }] : []),
                ...(brew.tds != null ? [{ label: 'TDS', value: `${brew.tds}%` }] : []),
                ...(brew.extractionYield != null
                  ? [{ label: 'Extraction Yield', value: `${brew.extractionYield}%` }]
                  : brew.tds != null && brew.finalBrewWeight != null
                  ? [{ label: 'Extraction Yield', value: `${calcEY(brew.tds, brew.finalBrewWeight, brew.coffeeDose) ?? '—'}%` }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-brew-faint">{label}</span>
                  <span className="text-brew-text font-medium">{value}</span>
                </div>
              ))}
            </dl>
          </Card>

          {brew.brewRecipeName && (
            <Card className="p-5">
              <SectionTitle>Recipe</SectionTitle>
              <p className="text-brew-primary-light font-medium text-sm">{brew.brewRecipeName}</p>
              {brew.brewRecipeDetails && (
                <p className="text-brew-muted text-sm mt-2 whitespace-pre-wrap">{brew.brewRecipeDetails}</p>
              )}
            </Card>
          )}

          {/* Pour Over */}
          {brew.pourOverDetails && (
            <Card className="p-5">
              <SectionTitle>Pour Over Details</SectionTitle>
              <dl className="flex flex-col gap-2">
                {[
                  { label: 'Total Pours', value: brew.pourOverDetails.totalPours },
                  { label: 'Bloom Amount', value: `${brew.pourOverDetails.bloomAmount}g (${bloomRatio(brew.pourOverDetails.bloomAmount, brew.coffeeDose)})` },
                  { label: 'Bloom Time', value: `${brew.pourOverDetails.bloomTime} min` },
                  { label: 'Total Brew Time', value: `${brew.pourOverDetails.totalBrewTime} min` },
                  { label: 'Double Bloom', value: brew.pourOverDetails.doubleBloom ? 'Yes' : 'No' },
                  { label: 'Melodrip', value: brew.pourOverDetails.melodrip ? 'Yes' : 'No' },
                  { label: 'Pour Height', value: brew.pourOverDetails.pourHeight },
                  { label: 'Pour Speed', value: brew.pourOverDetails.pourSpeed },
                  { label: 'Agitation', value: brew.pourOverDetails.agitation },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-brew-faint">{label}</span>
                    <span className="text-brew-text font-medium">{value}</span>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {/* Espresso */}
          {brew.espressoDetails && (
            <Card className="p-5">
              <SectionTitle>Espresso Details</SectionTitle>
              <dl className="flex flex-col gap-2">
                {[
                  { label: 'Total Yield', value: `${brew.espressoDetails.totalYield}g` },
                  { label: 'Ratio', value: espressoRatio(brew.espressoDetails.totalYield, brew.coffeeDose) },
                  { label: 'Brew Time', value: `${brew.espressoDetails.brewTime}s` },
                  { label: 'Max Pressure', value: `${brew.espressoDetails.maxPressure} bar` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-brew-faint">{label}</span>
                    <span className="text-brew-text font-medium">{value}</span>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        {/* Right: Flavor */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <SectionTitle>Flavor Profile</SectionTitle>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e5ddd0" />
                <PolarAngleAxis dataKey="attr" tick={{ fill: '#a8907c', fontSize: 11 }} />
                <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
                <Radar
                  name="Flavor"
                  dataKey="value"
                  stroke="#5a3820"
                  fill="#5a3820"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e5ddd0', borderRadius: 8, boxShadow: '0 4px 12px rgba(90,56,32,0.1)' }}
                  labelStyle={{ color: '#6b5040' }}
                  itemStyle={{ color: '#5a3820' }}
                />
              </RadarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
              {radarData.map(({ attr, value }) => {
                const isNeg = attr === 'Astringency' || attr === 'Sourness';
                return (
                  <div key={attr} className="flex flex-col items-center p-2 bg-brew-surface rounded-lg">
                    <span className="text-xs text-brew-faint">{attr}</span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: isNeg && value > 3 ? '#9b3328' : isNeg ? '#a8907c' : '#5a3820' }}
                    >
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {brew.flavorProfile.flavorNotes && (
            <Card className="p-5">
              <SectionTitle>Tasting Notes</SectionTitle>
              <p className="text-brew-text text-sm italic">"{brew.flavorProfile.flavorNotes}"</p>
            </Card>
          )}

          {(moreOf.length > 0 || lessOf.length > 0 || brew.flavorProfile.suggestedChange) && (
            <Card className="p-5">
              <SectionTitle>Next Brew Reflection</SectionTitle>
              {moreOf.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-brew-positive uppercase tracking-wider font-medium mb-2">More of</p>
                  <div className="flex flex-wrap gap-1.5">
                    {moreOf.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-brew-positive/20 text-brew-positive text-xs rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {lessOf.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-brew-negative uppercase tracking-wider font-medium mb-2">Less of</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lessOf.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-brew-negative/20 text-brew-negative text-xs rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {brew.flavorProfile.suggestedChange && (
                <p className="text-brew-muted text-sm mt-2">
                  <span className="text-brew-faint">Suggested: </span>
                  {brew.flavorProfile.suggestedChange}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
