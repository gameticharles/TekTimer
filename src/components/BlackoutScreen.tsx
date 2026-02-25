interface BlackoutScreenProps {
    onReveal: () => void;
}

export default function BlackoutScreen({ onReveal }: BlackoutScreenProps) {
    return (
        <div
            className="fixed inset-0 bg-black z-50 flex items-center justify-center cursor-pointer select-none"
            onClick={onReveal}
            role="button"
            aria-label="Click to reveal timers"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onReveal();
            }}
        >
            {/* Faint hint only visible up close on invigilator's laptop */}
            <p className="text-gray-800 text-sm">
                Click anywhere or press B to reveal
            </p>
        </div>
    );
}
