/**
 * Pagination 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('총 페이지가 1개일 때 렌더링하지 않는다', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        totalItems={10}
        itemsPerPage={20}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('현재 페이지 정보를 표시한다', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    // 21-40 / 전체 100개 형식으로 표시
    expect(screen.getByText(/21-40/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('이전 버튼 클릭 시 이전 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={handlePageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const prevButton = screen.getByRole('button', { name: /이전/i });
    await user.click(prevButton);

    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('다음 버튼 클릭 시 다음 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={handlePageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const nextButton = screen.getByRole('button', { name: /다음/i });
    await user.click(nextButton);

    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('첫 페이지에서 이전 버튼이 비활성화된다', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const prevButton = screen.getByRole('button', { name: /이전/i });
    expect(prevButton).toBeDisabled();
  });

  it('마지막 페이지에서 다음 버튼이 비활성화된다', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const nextButton = screen.getByRole('button', { name: /다음/i });
    expect(nextButton).toBeDisabled();
  });

  it('페이지 번호 버튼 클릭 시 해당 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={handlePageChange}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const page3Button = screen.getByRole('button', { name: /3페이지/i });
    await user.click(page3Button);

    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('현재 페이지 버튼이 활성화 스타일로 표시된다', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={vi.fn()}
        totalItems={100}
        itemsPerPage={20}
      />
    );

    const page3Button = screen.getByRole('button', { name: /3페이지/i });
    expect(page3Button).toHaveAttribute('aria-current', 'page');
  });

  it('페이지가 많을 때 생략 부호를 표시한다', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={20}
        onPageChange={vi.fn()}
        totalItems={400}
        itemsPerPage={20}
      />
    );

    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });
});
