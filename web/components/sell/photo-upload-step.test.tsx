import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import type { PhotoDraft } from '@/types/sell';
import { PhotoUploadStep } from './photo-upload-step';

const blur = vi.hoisted(() => ({
  mockDetectBlurRegions: vi.fn(),
}));

vi.mock('@/lib/mock/photo-blur', () => ({
  mockDetectBlurRegions: blur.mockDetectBlurRegions,
}));

// Небольшой стейтфул-обвес вокруг controlled-компонента — имитирует то, как
// SellWizard прокидывает photos/колбэки через свой reducer, без завязки на
// реальный wizard-flow.ts в этом тесте (он покрыт отдельно).
function Harness({ onComplete = vi.fn() }: { onComplete?: () => void }) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);

  return (
    <PhotoUploadStep
      photos={photos}
      onAddPhoto={(photo) => setPhotos((prev) => [...prev, photo])}
      onRemovePhoto={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
      onBlurPending={(id) =>
        setPhotos((prev) =>
          prev.map((p) => (p.id === id ? { id, status: 'BLUR_PENDING', previewUrl: p.previewUrl } : p))
        )
      }
      onBlurDone={(id, regions) =>
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === id ? { id, status: 'BLUR_DONE', previewUrl: p.previewUrl, detectedRegions: regions } : p
          )
        )
      }
      onBlurFailed={(id, error) =>
        setPhotos((prev) =>
          prev.map((p) => (p.id === id ? { id, status: 'BLUR_FAILED', previewUrl: p.previewUrl, error } : p))
        )
      }
      onSetManualRegions={(id, regions) =>
        setPhotos((prev) =>
          prev.map((p) => (p.id === id && p.status === 'BLUR_DONE' ? { ...p, manualRegions: regions } : p))
        )
      }
      onComplete={onComplete}
    />
  );
}

const FILE = new File(['fake-image-bytes'], 'car.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  blur.mockDetectBlurRegions.mockReset();
  blur.mockDetectBlurRegions.mockResolvedValue([{ x: 0.35, y: 0.72, width: 0.3, height: 0.1 }]);
});

test('uploading a photo runs blur detection and shows the done state', async () => {
  render(<Harness />);

  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);

  expect(await screen.findByText('Номер и VIN замазаны')).toBeInTheDocument();
  expect(blur.mockDetectBlurRegions).toHaveBeenCalledTimes(1);
});

test('shows a retry action and recovers when blur detection fails then succeeds', async () => {
  blur.mockDetectBlurRegions.mockRejectedValueOnce(new Error('BLUR_DETECTION_FAILED'));
  render(<Harness />);

  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  expect(await screen.findByText('Не удалось определить область для блюра')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Номер и VIN замазаны')).toBeInTheDocument();
});

test('lets the seller open manual blur adjustment with the detected region prefilled', async () => {
  render(<Harness />);

  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  await screen.findByText('Номер и VIN замазаны');

  await userEvent.click(screen.getByRole('button', { name: 'Скорректировать область блюра' }));

  expect(screen.getByLabelText('X %')).toHaveValue(35);
  expect(screen.getByLabelText('Y %')).toHaveValue(72);

  await userEvent.clear(screen.getByLabelText('X %'));
  await userEvent.type(screen.getByLabelText('X %'), '40');
  expect(screen.getByLabelText('X %')).toHaveValue(40);
});

test('removing a photo revokes its object URL', async () => {
  render(<Harness />);

  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  await screen.findByText('Номер и VIN замазаны');

  await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  expect(screen.queryByText('Номер и VIN замазаны')).not.toBeInTheDocument();
});

test('blocks advancing to the next step until at least one photo is added', async () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete} />);

  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(await screen.findByText('Добавьте хотя бы одно фото')).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
});

test('calls onComplete once a photo has been added', async () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete} />);

  await userEvent.upload(screen.getByLabelText('Добавить фото'), FILE);
  await screen.findByText('Номер и VIN замазаны');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));

  expect(onComplete).toHaveBeenCalledTimes(1);
});
