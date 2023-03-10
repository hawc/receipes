import useSWR, { useSWRConfig } from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useState, useEffect, useRef, createRef } from 'react';
import {
  ShoppingCartIcon,
  XMarkIcon,
  ArrowUpOnSquareIcon,
  TrashIcon,
  PencilIcon,
  PhotoIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { Desktop, Mobile } from '@/components/responsive';
import { IngredientList } from '@/components/IngredientList';
import { gql, GraphQLClient } from 'graphql-request';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Ingredient, Receipe } from 'types/receipe';
import { getStaticData } from 'graphql/build';
import { ThumbnailList } from '@/components/thumbnailList';

const ENDPOINT =
  process.env.NODE_ENV === `production`
    ? `https://kochen.hawc.de/api/receipes`
    : `http://localhost:3000/api/receipes`;

const QUERY_DELETE_RECEIPE = gql`
  mutation deleteReceipe($id: Int!) {
    deleteReceipe(id: $id) {
      id
      categories
      name
      slug
      ingredients {
        name
        amount
        unit
      }
      images {
        name
        width
        height
      }
    }
  }
`;

export async function getStaticProps() {
  // can't use graphql here, because API doesn't exist when getStaticProps runs
  const receipes = await getStaticData(`receipes`);
  const categories = (receipes as Receipe[]).map((receipe) => {
    return receipe.categories;
  });

  return {
    props: {
      posts: receipes,
      categories: Array.from(new Set(categories.flat())),
    },
  };
}

export default function Home({ posts, categories }) {
  const { mutate } = useSWRConfig();

  const [viewThumbnails, setViewThumbnails] = useState(true);
  const [mounted, setMounted] = useState(false);
  const ingredientsRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedReceipes, setSelectedReceipes] = useState([]);
  const [buyList, setBuyList] = useState([]);
  const [postdata, setPostdata] = useState(posts);
  const [filteredReceipes, setFilteredReceipes] = useState(postdata);
  const [isNativeShare, setNativeShare] = useState(false);
  const [image, setImage] = useState(``);

  const { user, error, isLoading } = useUser();

  const categorydata = categories;

  useEffect(() => {
    if (navigator.share) {
      setNativeShare(true);
    }
    setMounted(true);
  }, []);

  function mergeArrays(ingredientArrays: Ingredient[][]): Ingredient[] {
    let finalList = [];

    if (ingredientArrays.length > 0) {
      ingredientArrays.forEach((ingredientArray) => {
        finalList = [...finalList, ...ingredientArray];
      });
    }
    finalList.sort((a, b) => a.name.localeCompare(b.name));

    return finalList;
  }

  function isInSelectedReceipes(receipe: Receipe): boolean {
    const isInSelectedReceipes = selectedReceipes.find(
      (selectedReceipe) => selectedReceipe.id === receipe.id,
    );
    return new Boolean(isInSelectedReceipes).valueOf();
  }

  function addToList(receipe: Receipe): void {
    if (isInSelectedReceipes(receipe)) {
      setSelectedReceipes(
        selectedReceipes.filter(
          (selectedReceipe) => selectedReceipe.id !== receipe.id,
        ),
      );
    } else {
      setSelectedReceipes((selectedReceipes) => [...selectedReceipes, receipe]);
    }
  }

  useEffect(() => {
    const arr = mergeArrays(
      [...selectedReceipes].map((receipe) => receipe.ingredients),
    );
    const res = Array.from(
      arr
        .reduce((acc, { amount, ...r }) => {
          const key = JSON.stringify(r);
          const current = acc.get(key) || { ...r, amount: 0 };
          return acc.set(key, { ...current, amount: current.amount + amount });
        }, new Map())
        .values(),
    );
    setBuyList(res);
  }, [selectedReceipes]);

  function optionsChangeHandler(event: ChangeEvent<HTMLSelectElement>): void {
    if (event.currentTarget) {
      let filteredPostdata = postdata;
      if (event.currentTarget.value !== ``) {
        filteredPostdata = postdata.filter((post) => {
          return post.categories.includes(event.currentTarget.value);
        });
      }

      setFilteredReceipes(filteredPostdata);
    }
  }

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    const data = await res.json();

    if (res.status !== 200) {
      throw new Error(data.message);
    }
    return data;
  };

  const { data } = useSWR(() => {
    return previewImage.images[0].name
      ? `/api/image?name=${previewImage.images[0].name}`
      : null;
  }, fetcher);

  useEffect(() => {
    if (data) {
      setImage(data);
    }
  }, [data]);

  async function deleteReceipe(id: number): Promise<void> {
    const client = new GraphQLClient(ENDPOINT, { headers: {} });

    const receipes = await client.request(QUERY_DELETE_RECEIPE, { id });
    mutate(`/`);
    if (receipes) {
      setPostdata(receipes.deleteReceipe);
    }
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.message}</div>;

  const receipeRefs = {};

  const postListItems = postdata.map((post: Receipe) => {
    const isFiltered = filteredReceipes
      .map((filteredPost) => filteredPost.id)
      .includes(post.id);
    receipeRefs[post.id] = createRef();

    return (
      <div key={post.id}>
        <Desktop>
          <div
            onMouseEnter={() => post.images.length > 0 && setPreviewImage(post)}
            onMouseLeave={() => setPreviewImage(null)}
            onBlur={() => setPreviewImage(null)}
            ref={receipeRefs[post.id]}
            className={
              isFiltered
                ? `is-flex is-font-size-1-2`
                : `is-flex is-font-size-1-2 opacity-40`
            }
          >
            <Link
              onFocus={() => post.images.length > 0 && setPreviewImage(post)}
              onBlur={() => setPreviewImage(null)}
              className="has-text-primary is-flex-basis-100 mb-1"
              href={`/rezept/${post.slug}`}
            >
              {post.name}
            </Link>
            {user && (
              <>
                <Link
                  className="button is-white is-small"
                  href={`/rezept/bearbeiten/${post.slug}`}
                >
                  <span className="icon is-medium">
                    <PencilIcon />
                  </span>
                </Link>
                <button
                  title="Rezept l??schen"
                  type="button"
                  className="button is-white is-small"
                  onClick={() => deleteReceipe(post.id)}
                >
                  <span className="icon is-medium">
                    <TrashIcon />
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              className="button is-white is-small"
              onClick={() => addToList(post)}
            >
              <span className="icon is-medium">
                {isInSelectedReceipes(post) ? (
                  <XMarkIcon />
                ) : (
                  <ShoppingCartIcon />
                )}
              </span>
            </button>
          </div>
        </Desktop>
        <Mobile>
          <div
            ref={receipeRefs[post.id]}
            className={`is-font-size-1-2 is-flex receipeListItem ${
              isFiltered ? `` : `opacity-40`
            }`}
          >
            <Link
              className="has-text-primary is-flex-basis-100 mb-2"
              href={`/rezept/${post.slug}`}
            >
              {post.name}
            </Link>
            {user && (
              <>
                <Link
                  className="button is-white is-small"
                  href={`/rezept/bearbeiten/${post.slug}`}
                >
                  <span className="icon is-medium">
                    <PencilIcon />
                  </span>
                </Link>
                <button
                  title="Rezept l??schen"
                  type="button"
                  className="button is-white is-small"
                  onClick={() => deleteReceipe(post.id)}
                >
                  <span className="icon is-medium">
                    <TrashIcon />
                  </span>
                </button>
              </>
            )}
            <button
              title="zur Einkaufsliste hinzuf??gen"
              type="button"
              className="button is-white is-small"
              onClick={() => addToList(post)}
            >
              <span className="icon is-medium">
                {isInSelectedReceipes(post) ? (
                  <XMarkIcon />
                ) : (
                  <ShoppingCartIcon />
                )}
              </span>
            </button>
          </div>
        </Mobile>
      </div>
    );
  });

  return (
    <section className="section pt-5">
      <div className="container is-max-desktop">
        <h2 className="title is-3 is-size-4-mobile is-flex mb-3 mt-2 is-align-items-center">
          <div className="mr-4 is-flex-grow-1-mobile">Rezepte</div>
          <div className="select is-inline-block is-size-6 is-rounded mr-2">
            <select
              aria-label="Kategorie ausw??hlen"
              onChange={optionsChangeHandler}
            >
              <option value="">Alle</option>
              {categorydata.map((category: any) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              title="Rezept l??schen"
              type="button"
              className="button is-white"
              onClick={() => setViewThumbnails(!viewThumbnails)}
            >
              <span className="icon is-medium">
                {!viewThumbnails ? <PhotoIcon /> : <ListBulletIcon />}
              </span>
            </button>
          </div>
        </h2>
        {mounted &&
          (viewThumbnails ? (
            <ThumbnailList
              receipes={posts}
              filteredReceipes={filteredReceipes}
            ></ThumbnailList>
          ) : (
            <div className="columns">
              <div className="column">
                {postListItems}
                {buyList.length > 0 && (
                  <>
                    <h2 className="title is-3 is-size-4-mobile mb-3 mt-6">
                      Einkaufsliste
                      {isNativeShare && (
                        <button
                          title="Einkaufsliste teilen"
                          type="button"
                          className="button is-white ml-1 is-va-baseline"
                          onClick={() => ingredientsRef.current.shareList()}
                        >
                          <span className="icon is-medium">
                            <ArrowUpOnSquareIcon />
                          </span>
                        </button>
                      )}
                    </h2>
                    <div className="block">
                      <IngredientList
                        ref={ingredientsRef}
                        list={buyList}
                      ></IngredientList>
                    </div>
                  </>
                )}
              </div>
              <Desktop>
                <div className="column">
                  <div>
                    {previewImage?.images.length > 0 && image && (
                      <Link href={`/rezept/${previewImage?.slug}`}>
                        <Image
                          src={`data:image/png;base64,${image}`}
                          className="box p-0 max-width-100"
                          alt="Rezeptvorschau"
                          width={previewImage?.images[0].width}
                          height={previewImage?.images[0].height}
                        />
                      </Link>
                    )}
                  </div>
                </div>
              </Desktop>
            </div>
          ))}
      </div>
    </section>
  );
}
